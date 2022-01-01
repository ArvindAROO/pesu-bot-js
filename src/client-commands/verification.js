// Verification Related

const config = require('../config.json');
const clientInfo = require("./clientHelper");
const {sleep} = require('./misc');
const {MessageEmbed} = require('discord.js')


class Verification {
    constructor() {
        this.commands = [
            "verify", // TODO: Embedding
            "info",
            "deverify",
            // "file"
        ];
    }

    verify = async (message, args) => {
        clientInfo.message = message;
        await message.channel.sendTyping();

        var purgeMessageList = [message]; // Accumulating messages to later purge

        // Check for verified role already present
        if (message.member.roles.cache.some(
            (role) => [config.verified].includes(role.id)
        )) {
            const msg2 = await message.reply("You're already verified. Are you trying to steal someone's identity, you naughty little...");
            purgeMessageList.push(msg2);
            await sleep(5);
            await message.channel.bulkDelete(purgeMessageList);
            return;
        }

        // Mongoose for user data
        const mongoose = require('mongoose');

        // Check if arguments are present
        if (args.length == 0) {
            const msg2 = await message.reply("Put your SRN/PRN");
            purgeMessageList.push(msg2);
            await sleep(5);
            await message.channel.bulkDelete(purgeMessageList);
            return;
        }

        // Get SRN/PRN, named as USN from here on
        const usn = args[0].toUpperCase();

        // Get collection from batch year
        const {batch_2018, batch_2019, batch_2020, batch_2021, verified} = require('./models');
        const year = usn.substring(6, 8);
        let dbc = null; // Collection object
        let sec = null; // This is done because PRN based verification use section for validation
        var finder = {SRN: usn}; // Default collection finder will be SRN based. Only for 2021 batch, it is PRN based (for now)
        if (year === "18"){
            dbc = batch_2018;
            sec = true;
        }
        else if (year === "19"){
            dbc = batch_2019;
            sec = false;
        }
        else if (year === "20"){
            dbc = batch_2020;
            sec = false;
        }
        else if (year === "21"){
            dbc = batch_2021;
            sec = true;
            finder = {PRN: usn};
        }
        else {
            const msg2 = await message.reply("Check your SRN/PRN and try again");
            purgeMessageList.push(msg2);
            await sleep(5);
            await message.channel.bulkDelete(purgeMessageList);
            return;
        }

        // Mongoooooooooooooooooooooooooooose
        mongoose.connect('mongodb://localhost:27017/pesu',
        {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Get PESU academy details from SRN/PRN
        const batchRes = await dbc.findOne(finder);
        if(batchRes === null ){
            const msg2 = await message.reply("Given SRN/PRN not found. Try again");
            purgeMessageList.push(msg2);
            await sleep(5);
            await message.channel.bulkDelete(purgeMessageList);
            return;
        }

        // To check if given SRN is already verified
        const verRes = await verified.findOne({PRN: batchRes.PRN});
        if(verRes != null) {
            const msg2 = await message.reply("SRN already verified");
            purgeMessageList.push(msg2);
            await sleep(5);
            await message.channel.bulkDelete(purgeMessageList);
            return;
        }

        // Section/PRN based validation step
        var validate = ""; // User response. Will be filled in message collector later
        var check = ""; // Database response with which validation happens
        if(sec === true) {
            var msg2 = await message.reply("Now enter your section to complete verification");
            validate = "Section ";
            check = batchRes.Section;
        }
        else {
            var msg2 = await message.reply("Now enter your PRN to complete verification");
            check = batchRes.PRN;
        }
        purgeMessageList.push(msg2);

        // Message collector for validation response by user
        const filter = m => m.author.id === message.author.id // Filter for message collector
        const collector = message.channel.createMessageCollector({filter, max: 1, time: 30000}); //Timeout in ms
        var success = null;
        collector.on('collect', function(msg) {
            // If Section/PRN matches and verification success
            var msg3 = msg;
            purgeMessageList.push(msg3);
            validate += msg.content.toUpperCase();
            if (check===validate){
                success = true;
            }
            else {
                success = false;
            }
            message = msg
        });
        collector.on('end', async function(collected) {
            // Timeout message
            if(collected.size === 0){
                const msg4 = await message.channel.send("Timed out. Try again");
                purgeMessageList.push(msg4);
            }
            else {
                // On validation success
                if(success === true) {
                    const msg4 = await message.reply("Verification success");
                    purgeMessageList.push(msg4);

                    // Get appropriate role based on branch and year of study
                    if (year === "18"){
                        const roleId = "802008729191972905";
                        var role = message.guild.roles.cache.get(roleId);
                    }
                    else if (year === "19"){
                        const roleStr = batchRes.CandB.toString().replace(' Campus', '').replace(' ', '').replace('BIOTECHNOLOGY','BT')
                        var role = message.guild.roles.cache.find((r) => r.name === roleStr)
                    }
                    else if (year === "20"){
                        const roleStr = batchRes.Branch + "(Junior)"
                        var role = message.guild.roles.cache.find((r) => r.name === roleStr)
                    }
                    else {
                        const roleStr = batchRes.Branch + "(Kid)"
                        var role = message.guild.roles.cache.find((r) => r.name === roleStr)
                    }

                    // Get verified and 'just joined' role
                    const verified_role = message.guild.roles.cache.get(config.verified);
                    const just_joined_role = message.guild.roles.cache.get(config.just_joined);

                    // Add required roles and remove just joined role
                    await message.member.roles.add([role, verified_role]);
                    await message.member.roles.remove(just_joined_role);

                    // Add data to verified collection in mongoDB
                    const verifiedDoc = new verified(
                        {
                            Username: message.member.displayName,
                            ID: message.member.id.toString(),
                            PRN: batchRes.PRN
                        }
                    );
                    await verifiedDoc.save(function (err, verified) {
                        if (err) throw err;
                    });
                }
                else {
                    const msg4 = await message.reply("Verification failed");
                    purgeMessageList.push(msg4);
                }
            }

            // Purge the messages
            await sleep(5);
            await message.channel.bulkDelete(purgeMessageList);
        });
    }

    info = async (message, args) => {
        clientInfo.message = message;
        await message.channel.sendTyping();

        // Check appropriate roles
        if (message.member.roles.cache.some((role => [config.admin, config.mod, config.botDev].includes(role.id)))) {
            if (args.length == 0) {
                await message.reply("Mention a user to get info about")
            }
            else {
                // Mentions check
                // Since reply is also a mention technically, need to remove it first if it exists
                if(message.type === "REPLY"){
                    message.mentions.members.delete(message.mentions.repliedUser.id);
                }
                var membMention = message.mentions.members.first();

                // Get arguments
                const mem = args[0].toString();

                // Find member ID based on either mention, nickname or ID
                const member = message.guild.members.cache.find((m) => {
                    if(membMention != null) {
                        return membMention.id === m.id
                    }
                    else if (isNaN(mem)) {
                        return mem === m.nickname
                    }
                    else {
                        return mem === m.id
                    }
                })
                if(member === null) {
                    await message.reply("Mention a valid user (either @ them or type their name or put their user ID")
                }
                else{

                    // Connect to MongoDB
                    const mongoose = require('mongoose');
                    const {batch_2018, batch_2019, batch_2020, batch_2021, verified} = require('./models');
                    mongoose.connect('mongodb://localhost:27017/pesu',
                    {
                        useNewUrlParser: true,
                        useUnifiedTopology: true
                    });

                    // Get user data from verified collection
                    const verRes = await verified.findOne({ID: member.id});
                    if(verRes === null){
                        await message.reply("This user is not verified yet")
                        return
                    }

                    // Get year of study for getting batch data
                    const year = verRes.PRN.substring(6, 8)
                    let dbc = null;
                    if(year === "18"){
                        dbc = batch_2018
                    }
                    else if(year === "19"){
                        dbc = batch_2019
                    }
                    else if(year === "20"){
                        dbc = batch_2020
                    }
                    else{
                        dbc = batch_2021
                    }

                    // Get Batch Data for remaining data
                    const batchRes = await dbc.findOne({PRN: verRes.PRN})
                    const details = {
                        "Username": verRes.Username,
                        "MemberID": verRes.ID,
                        "PRN": batchRes.PRN,
                        "SRN": batchRes.SRN,
                        "Semester": batchRes.Semester,
                        "Section": batchRes.Section,
                        "Cycle": batchRes.Cycle,
                        "Stream/Campus": batchRes.CandB,
                        "Stream": batchRes.Branch,
                        "Campus": batchRes.Campus
                    }

                    // Create Embed to send
                    let sendEmbed = new MessageEmbed(
                        {
                            title: "User Data",
                            timestamp: Date.now(),
                            color: "0x48BF91"
                        }
                    )

                    // Add each details field in the embed
                    for (const key in details) {
                        sendEmbed.addField(key, details[key], true)
                    }
                    await message.reply({
                        embeds: [sendEmbed]
                    })
                }
            }
        }
        else {
            await message.reply("You are not authorised to run this command")
        }
    }

    deverify = async(message, args) => {
        clientInfo.message = message;
        await message.channel.sendTyping();
        // Check appropriate roles
        if (message.member.roles.cache.some((role => [config.admin, config.mod, config.botDev].includes(role.id)))) {
            if (args.length == 0) {
                await message.reply("Mention a user to get info about")
            }
            else {
                // Mentions check
                // Since reply is also a mention technically, need to remove it first if it exists
                if(message.type === "REPLY"){
                    message.mentions.members.delete(message.mentions.repliedUser.id);
                }
                var membMention = message.mentions.members.first();

                // Get arguments
                const mem = args[0].toString();

                // Find member ID based on either mention, nickname or ID
                const member = message.guild.members.cache.find((m) => {
                    if(membMention != null) {
                        return membMention.id === m.id
                    }
                    else if (isNaN(mem)) {
                        return mem === m.nickname
                    }
                    else {
                        return mem === m.id
                    }
                })
                if(member === null) {
                    await message.reply("Mention a valid user (either @ them or type their name or put their user ID")
                }
                else{
                    // Remove member details from verified collection
                    const {deverifyFunc} = require("./misc")
                    const ret = await deverifyFunc(member.id)
                    if(ret === true){
                        // Remove all roles of the member
                        let roleCollection = member.roles.cache
                        roleCollection.delete("742797665301168220") // @everyone role should be removed from the collection
                        await member.roles.remove(roleCollection);
                        const just_joined = member.guild.roles.cache.get(config.just_joined); // Adding just joined role
                        await member.roles.add(just_joined)
                        await message.reply("De-verified <@"+member.id+">")
                    }
                    else{
                        await message.reply("This user was not verified in the first place")
                    }
                }
            }
        }
    }

}

const verifyFunctions = new Verification()

module.exports = verifyFunctions

