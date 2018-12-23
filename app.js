const Discord = require('discord.js');
const client = new Discord.Client();

const RSSParser = require('rss-parser');
const parser = new RSSParser();

const SQLite = require("better-sqlite3");
const servers = new SQLite('./servers.sqlite');

const cron = require('node-cron');

const fs = require('fs');

// Import custom config json file
const config = require('./config.json');


// Parses BrainyQuote RSS for daily quotes
var fetchQuote = new Promise(function(resolve, reject) {
    let quote = '__**Today\s quotes**__';
    parser.parseURL('https://www.brainyquote.com/link/quotebr.rss', function(err, feed) {

        feed.items.forEach(function(entry) {
            quote += `${entry.title}: ${entry.content}\n`;
        });

        resolve(quote);
    });
});

// On successful login of Discord client
client.on('ready', function() {
    // Check if the table "servers" exists.
    const table = servers.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'servers';").get();
    if (!table['count(*)']) {
        // If the table isn't there, create it and setup the database correctly.
        servers.prepare("CREATE TABLE servers (id TEXT PRIMARY KEY, guild TEXT, channel TEXT);").run();
        // Ensure that the "id" row is always unique and indexed.
        servers.prepare("CREATE UNIQUE INDEX idx_servers_id ON servers (id);").run();
        servers.pragma("synchronous = 1");
        servers.pragma("journal_mode = wal");
    }

    // Helper methods for fetching, manipulating, and removing servers from database
    client.getServer = servers.prepare("SELECT * FROM servers WHERE guild = ?");
    client.setServer = servers.prepare("INSERT OR REPLACE INTO servers (id, guild, channel) VALUES (@id, @guild, @channel);");
    client.removeServer = servers.prepare("DELETE FROM servers WHERE guild = ?");

    // Fetches new quotes from RSS feed daily at 12:00 GMT-5:00
    let schedule = cron.schedule('0 12 * * *', function() {
        fetchQuote.then(function(quotes) {
            client.guilds.forEach(function(guild) {
                console.log(guild);
                let server = client.getServer.get(guild.id);
                if (!server) return;

                client.channels.get(server.channel).send(quotes);
                console.log(server.guild);
            })
        }), {
            scheduled: true,
            timezone: 'America/Chicago'
        };
    });

    console.log('Ready!');
    schedule.start();
});

// On receiving any message beginning with given command prefix not sent by a bot
client.on('message', function(message) {
    if (message.content.substring(0, config.prefix.length) !== config.prefix) return;
    if (message.author.bot) return;

    let command = message.content.substring(config.prefix.length).toLowerCase();

    if (message.guild) {
        // Adds current channel to daily quotes catalog
        if (command === 'quotesignup') {
            let server = client.getServer.get(message.guild.id);

            //Creates a new entry in servers database if none exists, or removes the entry otherwise
            if (!server) {
                server = {
                    id: `${message.guild.id}-${message.channel.id}`,
                    guild: message.guild.id,
                    channel: message.channel.id
                }

                client.setServer.run(server);

                message.channel.send(`${message.guild.channels.get(message.channel.id).toString()}`
                    + ` is now signed up to receive daily quotes!`);
            } else {
                client.removeServer.run(message.guild.id);

                message.channel.send(`${message.guild.channels.get(message.channel.id).toString()}`
                    + ` is no longer signed up to receive daily quotes.`);
            }
        }
    }

    // Returns 'Pong!', used to determine online status
    if (command === 'ping') {
        message.channel.send('Pong!')
    }

    // Fetches brainyquote.com daily quotes and sends them in one message to Discord
    if (command === 'brainyquote') {
        fetchQuote.then(function(quote) {
            message.channel.send(quote);
        });
    }
});

client.login(config.token);