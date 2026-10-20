----
title: AI Prompt Walkthrough for Vibe Coding
description: Take a look at the universal workflow that works for any LLM with promising results per prompt.
keywords: ai prompting, vibe coding, vibe coding tutorial, ai prompts, llm prompt, llm prompting, ai vibe coding
author: Ethan
time: 2026-04-13
category: Programming
core_keyword: Vibe Coding
image: https://plus.unsplash.com/premium_photo-1661877737564-3dfd7282efcb?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D
bluf: Modern times require modern solutions, so learn to vibe code by writing prompts for AI tools that can generate all the code for you, the easy and fast way for free with a real-life demonstration walkthrough
----

## A practical walkthrough of how to vibe code a website

1) describe exactly what you want (purpose: website, style: old 90s aesthetic, etc.) For visual clarity, use SHIFT + ENTER to add newlines/spaces between paragraphs. Add more paragraphs describing what could help the AI (background information).

```txt
provide code for a barebones minimal old-fashioned website with the least amount of code possible, most compact efficient code in HTML, JS only. CSS little to none. Insert all best practice SEO AEO tags, meta tags.

Information about the website:

Makron (title), shown in center above a nav bar.

Nav bar consisting of a bunch of URLs with 2 <hr> above and below. Current placeholder links: "About", "Image Converter", "Audio Converter", "PDF Tools", "Contact".

And add a marquee below the navbar with placeholder text "Welcome to the website! Check out our current services above or feel free to contact us for suggesting more.".

Stop center from here onwards.

By default, this would be homepage so it would contain a blank space for now. And then a hr with a section for stamp buttons (use placeholders for now) 81x33 (or was it 83x31?). Add 8 sample ones for now.

Add footer with "Made with love by independent heroes around the world".

```

2) Paste the output code into a file for better context parsing in the next attempt. Not everything may be perfect at the first try. Or maybe we may get more ideas after a previous output provided by the AI. So now we just attach the file (or paste the relevant code) into the chatbox and explain what changes you need.


```
great! Need some changes for the website now. Maybe define these colors as CSS variables and apply wherever necessary: 


dark-bg #303633 

primary #8BE8CB

secondary #7EA2AA 

accent #888DA7

border #9C7A97



also the "Made with love... around the world" part needs to be centered, yeah.



Must leave everything else intact, including all whitespace intact.
```

3) When adding lots of new information, better to tell it to convert to JSON format first. And ofcourse, sometimes you need to make small changes and edits yourself onto the code itself. Don't be too lazy. Use Ctrl + F to find specific text to change.


```
alright now modify the stamp buttons section by adding these real entries (image sources), and their tooltips, and their links (store them as a JSON for easy populating via JS):



https://chargercdn.vercel.app/img/stamp_getmozilla.gif :: Download the Firefox browser :: https://firefox.com/

https://womp.gay/buttons/ltt.gif :: Visit the cool tech bro LLT :: https://linustechtips.com/

https://womp.gay/buttons/me.png :: Visit an indie dev's website :: https://womp.gay/

https://chargercdn.vercel.app/img/stamp_1111.png :: Get the Cloudflare WARP technology :: https://1.1.1.1/

https://chargercdn.vercel.app/img/stamp_ddg.gif :: Less sussy search using DuckDuckGo :: https://duckduckgo.com/

https://chargercdn.vercel.app/img/stamp_7zip.gif :: Who needs WinRAR? 7zip is the way! :: https://www.7-zip.org/

https://chargercdn.vercel.app/img/stamp_grapheneos.gif :: Get a pure Android experience :: https://grapheneos.org/ 

https://chargercdn.vercel.app/img/stamp_fonts.gif :: Grab cool fonts from DaFont :: https://www.dafont.com/



add a subtle effect of a white outline appearing upon hover on those stamp buttons.



leave everything else intact! 
```


4) attach multiple files and mention them by name to transfer, merge, split or modify files wherever required. Better to use approval words and phrases to let the AI know that it is headed in the right direction, and if they mess up, gently point out errors (if any). Even if you have many things to do at once, better to do it step by step for the AI to focus on each specific task with a greater context window per message.

```

amazing progress! 

Now, split up the index.html file into modular pieces. There should be page-top.html that shall contain the whole title navbar marquee sections, and a page-bottom.html file that will contain everything from the advertisements stamps footer section. Every file will now contain JS that imports the top and bottom HTML files to rapidly populate and render the pages. E.g. for the homepage, the index.html will be an empty placeholder as usual with no content in the body for now. 

Keep everything else intact.

```
A good practice for any kind of software engineering / development is to keep everything modular with high cohesion and low coupling.

```

great! But split the loading script into a loader.js file separately and also the stylesheet as a separate theme.css file. And then provide the new updated index.html as well.


Must keep everything else intact!

```

5) Continue refining your project by instructing the AI and also attach any relevant files to refresh its memory.

```
 provide code for a new page for the audio_conv.html which shall use the new UI UX from index.html but should have same functionality and features as audio.html attached here. And split all JS for the audio stuff into audio.js
```

```
great! Now do the one for image tools. same as before: use the UI UX from homepage index and theme. Keep all image JS in a separate file, and all new specific CSS in a separate file. And finally provide image_tools.html file.
```

```
I was making a renovation of the webpage here (index.html, image.css, image.js) by migrating old version's features and functionalities from convimage.html but seems like not everything is working as it did before. Please provide full code for the index.html, image.css, image.js files (if any edits are required). Everything else intact!
```

6) It is better to use version controlling systems like Git (through GitHub) so that you can go back to a previous version of a file in case of emergencies or convenience.