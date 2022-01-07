// Commands anyone can use
const { Permissions } = require('discord.js');
const config = require('../config.json');
const clientInfo = require("./clientHelper");

class Utils {
    constructor() {
        this.commands = [
            "uptime",
            "ping",
            "support",
            "count",
            // "poll",
            // "pollshow",
            // "help",
            "snipe",
            "editsnipe"
        ];

        this.deletedMessage = null;
        this.editedMessage = null;
    }

    uptime = async (message) => {
        clientInfo.message = message;
        await message.reply("Bot was started <t:" + clientInfo.startTime + ":R>\ni.e., on <t:" + clientInfo.startTime + ":f>");
    }

    ping = async (message) => {
        clientInfo.message=message
        await message.channel.send(`Pong!!!\nPing =\`${clientInfo.client.ws.ping} ms\``);
    }

    support = async (message) => {
        clientInfo.message = message
        await message.reply("You can contribute to the bot here\nhttps://github.com/sach-12/pesu-bot-js")
    }

    count = async (message) => {
        clientInfo.message = message
        await message.channel.sendTyping();

        // Get role names separated by "&"
        let roleList = []
        const args = message.content.substring(message.content.indexOf(" ")+1).trim().split("&");

        // Get role collection for each role name and add to array
        args.forEach(roleStr => {
            const role = message.guild.roles.cache.find((r) => r.name === roleStr.trim())
            if(role != null) {
                roleList.push(role)
            }
        });
        const mems = message.guild.members.cache
        if(roleList.length === 0){
            await message.channel.send("No roles found. Processing request for server stats...")
            await message.channel.sendTyping();

            // Stats:
            const total = message.guild.members.cache.size
            const verifiedRole = message.guild.roles.cache.get(config.verified)
            let verified = 0
            let hooman = 0
            let bots = 0

            // Each member is being checked if they have the verified role, if they can view the message
            // origin channel and if they are a bot or not
            mems.each(member => {
                if(member.roles.cache.has(verifiedRole.id)){
                    verified += 1
                }
                const perms = message.channel.permissionsFor(member)
                const view_channel = Permissions.FLAGS.VIEW_CHANNEL
                if(perms.has(view_channel)){
                    if(member.user.bot){
                        bots += 1
                    }
                    else {
                        hooman += 1
                    }
                }
            })
            const stats = `**Server Stats:**\n\
            Total number of people on the server: \`${total}\`\n\
            Total number of verified people: \`${verified}\`\n\
            Number of people that can see this channel: \`${hooman}\`\n\
            Number of bots that can see this channel: \`${bots}\``
            await message.reply(stats)
        }
        else{
            // Requested roles
            let requested = " ["
            roleList.forEach(role => requested+=`${role.name}, `)
            requested = requested.slice(0, -2) + "]"
            await message.channel.send(`Got request for${requested}`)
            await message.channel.sendTyping();

            // Check each member of the server if they have the given set of roles
            let num = 0
            mems.each(member => {
                const memberRoles = member.roles.cache
                let bool = true // This boolean turns false if a member does not have even one role in the given set
                roleList.forEach(role => {
                    if(!memberRoles.has(role.id)) {
                        bool = false
                    }
                })
                if(bool === true){
                    num += 1
                }
            })
            await message.reply(`${num} people has/have ${requested}`)
        }
    }

    snipe = async (message) => {
        clientInfo.message = message
        await message.channel.sendTyping()

        // If no message was stored in snipe
        if(this.deletedMessage === null){
            await message.channel.send("There is nothing to snipe")
        }
        else{
            // Snipes only if command origin channel is the same as the sniped message origin channel
            if(this.deletedMessage.channel.id === message.channel.id){
                // If the deleted message replied to any other message, get the message ID the user replied to
                const reference = await this.deletedMessage.reference
                let repliedTo = null
                if(reference != null){
                    repliedTo = reference.messageId
                }

                // Fetch attachments if any were deleted
                const fileUrls = []
                this.deletedMessage.attachments.forEach((attach) => {
                    fileUrls.push(attach.proxyURL)
                })

                // Send the deleted message with the reply of the original message if it exists
                await message.channel.send({
                    content: `<@${this.deletedMessage.author.id}>: ${this.deletedMessage.content}`,
                    reply: {
                        messageReference: repliedTo
                    },
                    files: fileUrls
                })
                this.deletedMessage = null
            }
            else {
                await message.channel.send("There is nothing to snipe")
            }
        }
    }

    editsnipe = async (message) => {
        clientInfo.message = message

        // If no message was stored in edit-snipe
        if(this.editedMessage === null) {
            await message.channel.send("No edited message")
        }
        else {
            // Edit-snipes only if the command origin channel is the same as the edited message origin channel
            if(this.editedMessage.channel.id === message.channel.id){
                // To check if the message still exists
                const originnalMessage = await message.channel.messages.fetch(this.editedMessage)

                // If the message exists, get the ID for replying to it
                let repliedTo = null

                // If the message does not exist, try replying to who he/she replied to instead
                if(originnalMessage === null) {
                    const reference = await this.editedMessage.reference
                    if(reference != null) {
                        repliedTo = reference.messageId
                    }
                }

                // If the message exists, reply to it instead
                else {
                    repliedTo = this.editedMessage.id
                }

                let content = ""
                // If the command response has nothing to reply to or if the original message does not exist, 
                // add the message author tag to the response content
                if(repliedTo === null || originnalMessage === null){
                    content += `<@${this.editedMessage.author.id}> `
                }
                content += this.editedMessage.content

                await message.channel.send({
                    content: content,
                    reply: {
                        messageReference: repliedTo
                    }
                })
                this.editedMessage = null
            }
            else {
                await message.channel.send("No edited message")
            }
        }
    }
}
const utils = new Utils()

module.exports = utils