import { injectable, inject } from 'inversify';
import { IHandler } from '../contracts/IHandler';
import { Message, MessageMedia } from 'whatsapp-web.js';
import { Member, MemberPermission } from '../dtos/members';
import { TYPES } from '../../ioc/types';
import { IMusicService } from '../contracts/IMusicService';
import { IConfigsRepository } from '../contracts/IConfigsRepository';
import { hasPermissions } from '../../utils/hasPermissions';
import { IReqRegistersRepository } from '../contracts/IReqRegistersRepository';
import { ReqRegisterType } from '../dtos/reqRegister';
import { Logger } from 'winston';

@injectable()
export class MusicHandler implements IHandler {
    @inject(TYPES.MusicService) musicService: IMusicService;
    @inject(TYPES.ConfigsRepository) configsRepository: IConfigsRepository;
    @inject(TYPES.ReqRegistersRepository) reqRegistersRepository: IReqRegistersRepository;
    @inject(TYPES.Logger) logger: Logger;

    public commands = ['!musica', '!música'];

    canHandle(msg: Message, member: Member): boolean {
        if (!this.commands.some((command) => msg.body.startsWith(command))) {
            return false;
        }

        return hasPermissions(member, [MemberPermission.MESSAGE_CREATE], msg);
    }
    async handle(msg: Message): Promise<Message> {
        const { defaultMemberConfigs } = await this.configsRepository.getDefaultConfigs();
        try {
            const prompt = msg.body.split(' ').slice(1).join(' ');

            msg.reply(
                `${defaultMemberConfigs.botPrefix} Gerando música... (Leva em média 3 minutos)`
            );

            const musics = await this.musicService.generate(prompt);

            if (!musics || musics.length === 0) {
                return msg.reply(
                    `${defaultMemberConfigs.botPrefix} Ocorreu um erro ao gerar a música!`
                );
            }

            const [music] = musics;

            if (music.status === 'error') {
                this.logger.error('Erro ao gerar música:', music.error_message);
                return msg.reply(
                    `${defaultMemberConfigs.botPrefix} Algo deu errado. Tente novamente com um prompt menos específico.`
                );
            }

            const messageMedia = await MessageMedia.fromUrl(music.audio_url, {
                unsafeMime: true,
            });

            this.reqRegistersRepository.addRegister({
                author: msg.author,
                memberId: msg.from,
                timestamp: new Date(),
                type: ReqRegisterType.MUSIC,
            });

            return msg.reply(messageMedia);
        } catch (error) {
            this.logger.error('Erro ao gerar música:', error);
            return msg.reply(
                `${defaultMemberConfigs.botPrefix} Ocorreu um erro ao gerar a música!`
            );
        }
    }
}
