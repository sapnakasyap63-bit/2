const { Client, GatewayIntentBits } = require('discord.js');
const mineflayer = require('mineflayer');
const express = require('express');

// ---- WEB SERVER (RENDER KEEP-ALIVE) ----
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🌐 VorstyAFK Worker Node Online 24/7!'));
app.listen(PORT, () => console.log(`🌐 Keep-alive server running on port ${PORT}`));

// ---- DISCORD BOT SETUP ----
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const activeBots = new Map();

client.once('ready', () => {
    console.log(`🤖 AFK Worker Bot logged in as ${client.user.tag}`);
});

// ---- DISCORD COMMAND LISTENER ----
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Syntax: $deploy <botName> <server_ip> [port]
    if (message.content.startsWith('$deploy')) {
        const args = message.content.split(/\s+/);
        const botName = args[1];
        const ip = args[2];
        const rawPort = args[3];

        if (!botName || !ip) {
            return message.reply('❌ Use syntax: `$deploy <botName> <server_ip> [port]`');
        }

        let port = null;
        if (rawPort && !isNaN(parseInt(rawPort))) {
            port = parseInt(rawPort);
        }

        // Agar same bot already chal raha ho toh purna bot disconnect karke release karenge
        if (activeBots.has(botName)) {
            const existing = activeBots.get(botName);
            if (existing && existing.instance) {
                existing.shouldReconnect = false;
                existing.instance.quit();
            }
            activeBots.delete(botName);
        }

        const displayEndpoint = port ? `${ip}:${port}` : ip;
        message.reply(`⚙️ Deploying worker node \`${botName}\` onto target \`${displayEndpoint}\`...`);
        
        launchMinecraftBot(botName, ip, port, message);
    }

    // Manual stop command: $stopbot <botName>
    if (message.content.startsWith('$stopbot')) {
        const args = message.content.split(/\s+/);
        const botName = args[1];
        if (activeBots.has(botName)) {
            const botState = activeBots.get(botName);
            botState.shouldReconnect = false;
            if (botState.instance) {
                botState.instance.quit();
            }
            activeBots.delete(botName);
            return message.reply(`🛑 Bot node \`${botName}\` stopped and connection blocked.`);
        } else {
            return message.reply(`❌ No active bot found with name \`${botName}\`.`);
        }
    }
});

// ---- MINECRAFT AUTOMATION ENGINE ----
function launchMinecraftBot(botName, host, port, discordContext) {
    console.log(`📡 Instantiating framework node for client: ${botName}`);

    const botPassword = `VorstyPass_${Math.floor(100 + Math.random() * 900)}`;

    // Agar port na ho toh port property bilkul attach nahi hogi
    const botOptions = {
        host: host,
        username: botName,
        auth: 'offline',
        viewDistance: 'tiny'
    };

    if (port) {
        botOptions.port = port;
    }

    const bot = mineflayer.createBot(botOptions);

    const botState = {
        instance: bot,
        moveLoop: null,
        jumpLoop: null,
        chatLoop: null,
        shouldReconnect: false
    };

    activeBots.set(botName, botState);

    // Dynamic Register/Login Auto Trigger
    bot.on('message', (jsonMsg) => {
        const chatMessage = jsonMsg.toString().toLowerCase();

        if (chatMessage.includes('register') || chatMessage.includes('/register') || chatMessage.includes('reg')) {
            setTimeout(() => {
                if (bot && bot.entity) {
                    bot.chat(`/register ${botPassword}${botPassword}`);
                }
            }, 1500);
        }

        if (chatMessage.includes('login') || chatMessage.includes('/login') || chatMessage.includes('log ')) {
            setTimeout(() => {
                if (bot && bot.entity) {
                    bot.chat(`/login ${botPassword}`);
                }
            }, 1500);
        }
    });

    bot.once('spawn', () => {
        const targetStr = port ? `${host}:${port}` : host;
        console.log(`[${botName}] Connected to${targetStr}`);
        discordContext.channel.send(`✅ Client \`${botName}\` successfully attached to \`${targetStr}\`!`);

        setTimeout(() => {
            if (bot && bot.entity) {
                bot.chat(`/register ${botPassword}${botPassword}`);
                bot.chat(`/login ${botPassword}`);
            }
        }, 2000);

        // Anti-AFK Movement System
        botState.moveLoop = setInterval(() => {
            if (!bot || !bot.entity) return;
            const randomYaw = (Math.random() * 360) * (Math.PI / 180);
            const randomPitch = ((Math.random() * 60) - 30) * (Math.PI / 180);
            bot.look(randomYaw, randomPitch, true);

            const directions = ['forward', 'back', 'left', 'right'];
            const chosenDir = directions[Math.floor(Math.random() * directions.length)];
            
            bot.setControlState(chosenDir, true);
            setTimeout(() => { if (bot && bot.entity) bot.setControlState(chosenDir, false); }, 3000);
        }, 4000);

        botState.jumpLoop = setInterval(() => {
            if (!bot || !bot.entity) return;
            bot.setControlState('jump', true);
            setTimeout(() => { if (bot && bot.entity) bot.setControlState('jump', false); }, 500);
        }, 11000);

        botState.chatLoop = setInterval(() => {
            if (!bot.entity) return;
            bot.chat("MADE BY - VORSTYAFK");
        }, 30 * 60000);
    });

    bot.on('death', () => {
        try { bot.respawn(); } catch (err) {}
    });

    // Disconnect Alert Pipeline
    bot.on('end', (reason) => {
        clearInterval(botState.moveLoop);
        clearInterval(botState.jumpLoop);
        clearInterval(botState.chatLoop);

        try {
            discordContext.channel.send(`⚠️ **Alert:** Bot node \`${botName}\` disconnected. Reason: \`${reason}\`. Reconnection blocked.`);
        } catch (e) {}

        activeBots.delete(botName);
    });

    bot.on('error', (err) => {
        console.log(`[${botName}] Error:${err.message}`);
        try {
            discordContext.channel.send(`❌ **Error Alert:** Bot node \`${botName}\` failed: \`${err.message}\``);
        } catch (e) {}
    });
}

if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN);
} else {
    console.error("❌ DISCORD_TOKEN missing!");
}
