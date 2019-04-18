# $man
$man is jQuery-like library, but without any shit.

# Why?
I want to eliminate jQuery from my projects, but I still need to perform simple DOM queries and bind event handlers in a simple way. Writing `document.querySelectorAll` every time and iterate collections to make packet changes/binds is painful, so I grab some ideas and code from http://youmightnotneedjquery.com and wrote that light & simple library.

# How it works?
$man is doing some (probably) bad things: we are extending `NodeList` and `Element` prototypes with jQuery-like functions. 

Unlike jQuery, the main function (`$man('article')`) is just an alias to `document.querySelectorAll` and returning `NodeList` instance, so we making queries as fast as we can. Oh yes, almost all of $man functions are lightweight wrappers over the native DOM functions.

Almost all of $man functions are sharing the same names and logic with jQuery functions, e.g. `jQuery('article').find('div.element')` will be written as `$man('article').$find('div.element')` with $man.

**Important**: $man was created to make only DOM traversal and event binding, so it does not contain AJAX (use `fetch` or `axios`), animations (use CSS trantisions instead) or functions like `$.extend`, `$.type` and `$.proxy`.

# Can I just replace jQuery with $man?
The answer is **no**. $man is not fully compatible with jQuery and does not follow jQuery specifications strictly. You **cannot** make find-and-replace operations in your jQuery code to migrate to $man. For example, some functions like `filter` and `nextUntil` do not accept function as an argument. $man does not support Sizzle selectors like `:visible`. Functions like `each` will be never included to $man because you can iterate collections with `for..of` loops or `Array.prototype.forEach` functions.

Unlike jQuery, $man is standing away from adding a custom functionality or supporting old browsers with hacks: it's just making vanilla functions and methods ease to use. If you need to support IE8, you should make it yourself.
