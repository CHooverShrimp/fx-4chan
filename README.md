# fx-4chan
Try it: https://boards.fx4chan.org/g/thread/105076684

Embed your favourite 4chan posts right onto dicksword or other media!

## why?
\>le why? isn't 4chan already having embed header?

That's correct, but vanilla embed sucks. It's too long and irrelevant, or plain missing features. They don't embed image of the post, putting the content of the post as the title, and worse of all, do not support embedding of comments in the thread.

This is a lightweight and easy to understand solution. This solution truncates the name to make it more relevant (tldr lol), embed content and image from the OP as well as the comments in the OP.

## why le no caching?
You damn know why you should never cache images from 4chin lol

<img width="431" height="763" alt="image" src="https://github.com/user-attachments/assets/e04ce2d5-4e80-462e-a96f-0863fe0c0891" />


## How 2 use
\>Have source link: `https://boards.4chan.org/s4s/thread/12470187`

\>Replace the url with your own: `https://yourlink.org/s4s/thread/12470187`

### Warning: due to a quirk in how urls are handled, we can't parse hash fragments (such as 12470187#p12470355) which are typically seen on comment urls
To embed comments, replace hash (#) with slash (/).

i.e. `https://yourlink.org/s4s/thread/12470187/p12470355`

Unfortunately without this eggstra step :DDDDDDDDDDD, I haven't figured out a way to properly passing it.

## How 2 host

### node.js and express
Prerequisite: node.js

\>run ```npm install``` to install dependencies

\>run ```npm start``` to start a server, default port 3000

\>reverse proxy with nginx

\>profit

### Cloudflare
WARNING: Cloudflare worker is blocked by 4chan. All API calls are retuning error. You can use the cloudflare version as a redirect, but it's impossible to get an embed.

There's already a wrangler.toml set up to correctly build the right cloudflare version.

\>go to ```Workers & Pages```

\>create an application

\>import the git repo in WORKERS! NOT PAGES! 

\>on ```Build command```, assign ```npm install```
