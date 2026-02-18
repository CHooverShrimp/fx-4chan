# fx-4chan
Embed your favourite 4chan posts right onto >dicksword or other media!

## Try it
https://boards.fx4chan.org/g/thread/105076684

<img width="430" height="824" alt="image" src="https://github.com/user-attachments/assets/77cf87b0-bc60-4a36-b401-fb7d4d718150" />


The domain fx4chan.org is being maintained by a third party.

## why?
\>le why? doesn't 4chan already have embed header?

That's correct, but vanilla embed sucks. It's too long and irrelevant, or plain missing features. They don't embed image of the post, putting the content of the post as the title, and worse of all, do not support embedding of comments in the thread.

This is a lightweight and easy to understand solution. This solution truncates the name to make it more relevant (tldr lol), embed content and image from the OP as well as the comments in the OP.

<img width="533" height="657" alt="image" src="https://github.com/user-attachments/assets/27d6a40a-5527-457a-bd73-36c64cb665c1" />

## why le no caching?
You damn know why you should never cache images from 4chin lol

There's a setting for proxying images. This serves only to proxy to another service (i.e. Discord) and cache on their side. Nothing should be cached on the server. You can disable this in the settings.

## How 2 use
<img width="348" height="565" alt="image" src="https://github.com/user-attachments/assets/f55f4911-21f4-4a65-b054-7f424618770c" />

\>Have source link: `https://boards.4chan.org/s4s/thread/12795781`

\>Replace the url with your own: `https://yourlink.org/s4s/thread/12795781`

* The top line will tell you where it is from (straight from 4chan or one of its archives) and the board.
* The second line is the name of the poster.
* The third line is the name of the post (or post ID for comments).
* Embeds video and image at the bottom.
* THe color to the left will tell you if it's from a red board or a blue board (it's a red board on the above example).


### Warning: due to a quirk in how urls are handled, we can't parse hash fragments (such as 12470187#p12470355) which are typically seen on comment urls
To embed comments, replace hash (#) with slash (/).

i.e. `https://yourlink.org/s4s/thread/12795781/p12795792`

Unfortunately without this eggstra step :DDDDDDDDDDD, I haven't figured out a way to properly passing it.

### Archive integrations
fx-4chan is currently supporting desuarchive, b4k, 4plebs, and Archive.Moe.

<img width="478" height="593" alt="image" src="https://github.com/user-attachments/assets/08a6bc30-3de2-4e27-a789-6cca8a0a807c" />

You can tell which archive it is from by looking at the top of the embed. In this case, it is archived from Desuarchive.

## How 2 host

### node.js and express
Prerequisite: node.js

\>configure the application in ```config.js```

\>run ```npm install``` to install dependencies

\>run ```npm start``` to start a server, default port 3000

\>reverse proxy with nginx

\>profit

### Cloudflare
Cloudflare support is deprecated and is included for archival purposes.

WARNING: Cloudflare worker is blocked by 4chan. All API calls are retuning error. You can use the cloudflare version as a redirect, but it's impossible to get an embed.

There's already a wrangler.toml set up to correctly build the right cloudflare version.

\>go to ```Workers & Pages```

\>create an application

\>import the git repo in WORKERS! NOT PAGES!

\>on ```Build command```, assign ```npm install```
