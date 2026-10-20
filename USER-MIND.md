# Mirepoix's User's Mind

This is a dump of what the users think, want and imagine. It is meant to be organic and heterogeneos. Good luck!


## User requirements, statements, ideas and constraints

A user of the app, at least for now, is the only actor we're thinking about. Any statements in this section spoken in first person represents the user declaring their intentions, ideas, use cases, desires, constraints, etc.

I want to be able to see the same set of recipes from any of my devices.

I want to be able to copy/paste recipes from other sources, as well as type them.

When I copy a recipe from another source, I might paste sections or chunks at a time, and not always the full recipe in the same format.

I consider useful sections of a recipe at least these: Ingredients, Preparation, Variations, Notes.

I want to organize my recipes in such way that no matter how I input the ingredients, they're saved as quantity, unit and name. Unit might be almost anything (random examples: pinch, teaspoon, grams, pounds, ounces, liquid ounces, ml, count, etc.).

Optionally, if it doesn't get in my way, it would be good to be able to input alternative measures, like 2 cups or 437 grams of butter, but keeping it very clear that these are equivalents, and not additional to each other. It's just a matter of having a scale available or not when cooking, for example.

When I'm cooking, I don't want to accidentally modify the recipe. But I'd like to be able to easily add comments and notes for the future me at that point.

Because I want to share recipes between devices, I accept there will be some kind of storage on the server side, but it's okay to be creative and consider any option. I'm planning on hosting this on a regular web hosting thing, but we could consider storage on a free cloud option, or as files in a private dropbox, maybe a private free github repository, or files in my server, ... anything that doesn't publish the recipes open to the world but also doesn't get the developer and maintainer too distracted in having to maintain, watch and update a full-blown service.

I expect to use this to read recipes at most a couple of times per week, with bursts of dozens of times in one day.

I expect to use this to add or modify recipes at most a couple of times per week, with bursts of maybe one hundred on the first couple of days transcribing from my multiple books.

The app should not depend on hundreds of packages, but it doesn't need to be isolated either.

Single-page browser app is acceptable, as well as natively compiled binaries for MacOS, Windows, iOS. As long as it doesn't require spending more money or clunky/cumbersome usage.

Data should be encrypted at rest and in transit.

App needs to load and be ready to use (logins, handshakes, whatever) quickly. It's okay to take a few more steps at first, but returning users should have it zippy and reasonably ready to go. Don't sacrifice other characteristics for zippiness, but do what is reasonable and possible without cutting too short on them.

Phase incremental delivery of working value in such a way that the app is immediately useful on first release, and in every release after that, but it is expected that the first few releases will be very limited and it will improve over time. I'd rather try and touch anything than deliberate forever and deploy the first attempt at anything as an overly complex and complete solution. Completeness comes with time, if ever. Function is out very early and improves all the time.

No bloating. Visually, functionally and in the implementation.

Rock solid track of testability to leave every released behavior protected through verification and validation of future changes.
