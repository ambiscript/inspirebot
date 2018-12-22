const Discord = require('discord.js');
const client = new Discord.Client();

const RSSParser = require('rss-parser');
const parser = new RSSParser();

const config = require('./config.json');

client.on('ready', function() {
    console.log('Ready!');
});

client.on('message', function(message) {
    if (message.content[0] !== '!') return;

    let command = message.content.substring(1).toLowerCase();

    if (command === 'ping') {
        message.channel.send('Pong!')
    }

    if (command === 'brainyquote') {
        let quote = '';

        parser.parseURL('https://www.brainyquote.com/link/quotebr.rss', function(err, feed) {
            quote += `**${feed.title}**\n`;
    
            feed.items.forEach(function(entry) {
                quote += `${entry.title}: ${entry.content}\n`;
            });
    
            message.channel.send(quote);
        });
    }
});

client.login(config.token);