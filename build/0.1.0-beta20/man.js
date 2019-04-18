'use strict';

(() => {
	const w = window;
	const d = document;
	const arg_qselall = 'querySelectorAll';
	const qselall = d[arg_qselall].bind(d);
	const [ el_html ] = qselall('html');

	const class_node = Node;
	const class_element = Element;
	const class_list = NodeList;

	const def = (key, name, value) => {
		Object.defineProperty(key, name, { value });
	};

	const parseInt = w.parseInt;

	// Creating NodeList is a big deal
	// https://stackoverflow.com/questions/13351966/create-node-list-from-a-single-node-in-javascript
	// DO NOT create NodeList from DocumentFragment — it's remove nodes from document and append them to the DocumentFragment
	const createNodeList = (elements) => {
		if(elements instanceof Set === false){
			elements = new Set(elements);
		}
		elements = [ ...elements ];

		const node_list = d.createDocumentFragment().childNodes;

		const params = {};
		for(const i in elements){
			params[i] = {
				value: elements[i],
				enumerable: true
			};
		}
		params.length = { value: elements.length };
		params.item = {
			value: function(i){
				return this[+i || 0];
			},
			enumerable: true
		};

		// return an object pretending to be a NodeList
		return Object.create(node_list, params);
	};
	const parseHTML = (html) => {
		// const tmp = d.implementation.createHTMLDocument();
		// tmp.body.innerHTML = html;
		const tmp = d.createElement('div');
		tmp.innerHTML = html;

		for(const el of tmp.$find('script')){
			const el_new = d.createElement('script');
			{
				const attrs = el.$attrAll();
				for(const name in attrs){
					el_new.$attr(name, attrs[name]);
				}
			}
			el_new.innerHTML = el.innerHTML;
			el.$replaceWith(el_new);
		}
		return tmp.childNodes.$freeze();
	};

	const addToSet = (set, ...args) => {
		for(const one of args){
			set.add(one);
		}
	};

	const parseOnArgs = (events_list, ...args) => {
		const events = new Set(events_list.split(' '));
		let selector = null;
		let callback_given = null;
		let options = {};
		if(typeof(args[0]) === 'function'){
			[ callback_given, options ] = args;
		}
		else if(typeof(args[0]) === 'string' && typeof(args[1]) === 'function'){
			[ selector, callback_given, options ] = args;
		}

		if(null === callback_given){
			throw new Error('Invalid arguments.');
		}

		return { events, selector, callback_given, options };
	};

	const pel = {};
	const plist = {};
	const pwin = {};

	// Extend prototypes
	{
		const matchesSelector = (el, selector) => {
			if(void 0 === selector){
				return true;
			}
			else {
				return (el.matches || el.matchesSelector || el.msMatchesSelector || el.mozMatchesSelector || el.webkitMatchesSelector || el.oMatchesSelector).call(el, selector);
			}
		};

		const argsToNodes = (args, text_mode = 0) => {
			const nodes = [];
			if(Array.isArray(args[0])){
				args = args[0];
			}
			for(const arg of args){
				if(arg instanceof class_element || arg instanceof class_node){
					nodes.push(arg);
				}
				else if(arg instanceof class_list){
					nodes.push(...arg);
				}
				else if(typeof(arg) === 'string'){
					if(arg[0] === '<'){
						nodes.push(...parseHTML(arg));
					}
					else {
						if(1 === text_mode){
							nodes.push(d.createTextNode(arg));
						}
						else {
							nodes.push(...qselall(arg));
						}
					}
				}
			}
			return nodes;
		};

		const dashedToCamel = (key) => {
			return key.replace(/-([a-z])/, (_, letter) => letter.toUpperCase());
		};

		// Matched elements matching / change
		// is, add, filter, not
		// TODO has
		{
			plist.is = function(selector){
				return this[0] ? matchesSelector(this[0], selector) : false;
			};

			plist.add = function(...args){
				return createNodeList([ ...this, ...argsToNodes(args) ]);
			};

			const doFilter = (elements, filter, op = true) => {
				const nodes = [];
				for(const el of elements){
					if(matchesSelector(el, filter) === op){
						nodes.push(el);
					}
				}
				return createNodeList(nodes);
			};
			plist.filter = function(filter){
				return doFilter(this, filter);
			};
			plist.not = function(filter){
				return doFilter(this, filter, false);
			};
		}

		// DOM traversal
		// find, childs, parent, parents, parentsUntil, next, nextAll, prev, prevAll, siblings, contains
		// TODO nextUntil, prevUntil, contents
		{
			pel.find = function(selector){
				return this[arg_qselall](selector);
			};
			plist.find = function(selector){
				const nodes = [];
				for(const el of this){
					nodes.push(...el[arg_qselall](selector));
				}
				return createNodeList(nodes);
			};

			plist.childs = plist.children = function(selector){
				const need_filter = void 0 !== selector;
				const nodes = [];
				for(const el of this){
					if(need_filter){
						for(const el_child of el.children){
							if(matchesSelector(el_child, selector)){
								nodes.push(el_child);
							}
						}
					}
					else {
						nodes.push(...el.children);
					}
				}
				return createNodeList(nodes);
			};

			const getParents = (el, filter, opts = {}) => {
				const { until = null, recursive = true } = opts;
				const nodes = new Set();

				const el_parent = el.parentNode;
				if(!!el_parent && el_parent !== d){
					if(null === until || !matchesSelector(el_parent, until)){
						if(matchesSelector(el_parent, filter)){
							nodes.add(el_parent);
						}
						if(recursive){
							addToSet(nodes, ...getParents(el_parent, filter, opts));
						}
					}
				}

				return nodes;
			};
			plist.parent = function(filter){
				const nodes = new Set();
				for(const el of this){
					addToSet(nodes, ...getParents(el, filter, { recursive: false }));
				}
				return createNodeList(nodes);
			};
			plist.parents = function(filter){
				const nodes = new Set();
				for(const el of this){
					addToSet(nodes, ...getParents(el, filter));
				}
				return createNodeList(nodes);
			};
			plist.parentsUntil = function(selector, filter){
				const nodes = new Set();
				for(const el of this){
					addToSet(nodes, ...getParents(el, filter, { until: selector }));
				}
				return createNodeList(nodes);
			};

			const getNeighborElements = (el, selector, params = {}) => {
				const nodes = [];
				while(1){
					el = el[(true === params.prev ? 'previous' : 'next') + 'ElementSibling'];
					if(null === el || void 0 === el){
						break;
					}
					else if(void 0 === selector || matchesSelector(el, selector)){
						nodes.push(el);
						if(true === params.one){
							break;
						}
					}
				}
				return nodes;
			};
			plist.next = function(selector){
				const nodes = [];
				for(const el of this){
					const els_next = getNeighborElements(el, selector, { one: true });
					if(els_next.length > 0){
						nodes.push(els_next[0]);
					}
				}
				return createNodeList(nodes);
			};
			plist.nextAll = function(selector){
				const nodes = [];
				for(const el of this){
					const els_next = getNeighborElements(el, selector);
					nodes.push(...els_next);
				}
				return createNodeList(nodes);
			};
			plist.prev = function(selector){
				const nodes = [];
				for(const el of this){
					const els_next = getNeighborElements(el, selector, { prev: true, one: true });
					if(els_next.length > 0){
						nodes.push(els_next[0]);
					}
				}
				return createNodeList(nodes);
			};
			plist.prevAll = function(selector){
				const nodes = [];
				for(const el of this){
					const els_next = getNeighborElements(el, selector, { prev: true });
					nodes.push(...els_next);
				}
				return createNodeList(nodes);
			};

			plist.siblings = function(selector){
				const nodes = new Set();
				for(const el of this){
					for(const el_sibling of el.parentNode.children){
						if(el_sibling !== el && (void 0 === selector || matchesSelector(el_sibling, selector))){
							nodes.add(el_sibling);
						}
					}
				}
				return createNodeList(nodes);
			};

			plist.index = function(){
				return this[0] ? this[0].$prevAll().length : null;
			};

			plist.contains = function(selector){
				return this[0] ? this[0].querySelector(selector) !== null : false;
			};
		}

		// DOM operations
		// append, appendTo, prepend, prependTo, insertBefore, before, insertAfter, after, remove, detach, clone, replaceWith
		{
			{
				const ops = [
					(target, el) => {
						target.appendChild(el);
					},
					(target, el) => {
						target.insertBefore(el, target.firstChild);
					},
					(target, el) => {
						target.parentNode.insertBefore(el, target);
					},
					(target, el) => {
						const parent = target.parentNode;
						const next = target.nextSibling;
						if(next){
							parent.insertBefore(el, next);
						}
						else {
							ops[0](parent, el);
						}
					}
				];
				const addTo = (op_type, targets, elements, order = 0) => {
					const fn = ops[op_type];

					elements = argsToNodes(elements, +!order);
					const targets_copy = createNodeList(targets);

					const args = [];
					for(const el of targets_copy){
						args[order] = el;
						for(const node of elements){
							args[+!order] = node;
							fn(...args);
						}
					}

					return targets_copy;
				};
				plist.append = function(...args){
					return addTo(0, this, args);
				};
				plist.appendTo = function(...args){
					return addTo(0, this, args, 1);
				};
				plist.prepend = function(...args){
					return addTo(1, this, args);
				};
				plist.prependTo = function(...args){
					return addTo(1, this, args, 1);
				};
				plist.before = function(...args){
					return addTo(2, this, args);
				};
				plist.insertBefore = function(...args){
					return addTo(2, this, args, 1);
				};
				plist.after = function(...args){
					return addTo(3, this, args);
				};
				plist.insertAfter = function(...args){
					return addTo(3, this, args, 1);
				};

				plist.replaceWith = function(content){
					if(typeof content === 'string'){
						for(const el of this){
							el.outerHTML = content;
						}
					}
					else if(content instanceof class_element || content instanceof class_list){
						addTo(3, this, [ content ]);
						return this.$detach();
					}
					return this;
				};
			}

			// pel.remove = function(){
			// 	this.parentNode.removeChild(this);
			// };
			// plist.remove = function(){
			// 	for(const el of this){
			// 		el.parentNode.removeChild(el);
			// 	}
			// };
			const detach = (node) => node.parentNode.removeChild(node);
			pel.detach = pel.remove = function(){
				return detach(this);
			};
			plist.detach = plist.remove = function(){
				const nodes = [];
				for(const el of this){
					nodes.push(detach(el));
				}
				return createNodeList(nodes);
			};

			pel.clone = function(){
				return this.cloneNode(true);
			};
			plist.clone = function(){
				const nodes = [];
				for(const el of this){
					nodes.push(el.cloneNode(true));
				}
				return createNodeList(nodes);
			};
		}

		// Element size & position
		// width, innerWidth, outerWidth, height, innerHeight, outerHeight
		// TODO offset, position
		{
			const getWidthWithPadding = (el) => el ? el.clientWidth : void 0;
			plist.width = function(){
				const el = this[0];
				if(!el){
					return;
				}
				const styles = getComputedStyle(el);
				return getWidthWithPadding(el) - parseInt(styles.paddingLeft) - parseInt(styles.paddingRight);
			};
			plist.innerWidth = function(){
				return getWidthWithPadding(this[0]);
			};
			plist.outerWidth = function(with_margin){
				const el = this[0];
				if(!el){
					return;
				}
				let result = el.offsetWidth;
				if(true === with_margin){
					const styles = getComputedStyle(el);
					result += parseInt(styles.marginLeft) + parseInt(styles.marginRight);
				}
				return result;
			};

			const getHeightWithPadding = (el) => el ? el.clientHeight : void 0;
			plist.height = function(){
				const el = this[0];
				if(!el){
					return;
				}
				const styles = getComputedStyle(el);
				return getHeightWithPadding(el) - parseInt(styles.paddingTop) - parseInt(styles.paddingBottom);
			};
			plist.innerHeight = function(){
				return getHeightWithPadding(this[0]);
			};
			plist.outerHeight = function(with_margin){
				const el = this[0];
				if(!el){
					return;
				}
				let result = el.offsetHeight;
				if(true === with_margin){
					const styles = getComputedStyle(el);
					result += parseInt(styles.marginTop) + parseInt(styles.marginBottom);
				}
				return result;
			};

			plist.offset = function(){
				if(!this[0]){
					return;
				}
				const rect = this[0].getBoundingClientRect();
				return {
					top: rect.top + d.body.scrollTop,
					left: rect.left + d.body.scrollLeft
				};
			};
			plist.position = function(){
				const el = this[0];
				if(!el){
					return;
				}
				return {
					left: el.offsetLeft,
					top: el.offsetTop
				};
			};
		}

		// Element content:
		// html, text, empty
		{
			plist.html = function(...args){
				if(0 === args.length){
					return this.length > 0 ? this[0].innerHTML : void 0;
				}
				else {
					for(const el of this){
						el.innerHTML = args[0];
					}
					return this;
				}
			};
			plist.text = function(...args){
				if(0 === args.length){
					return this.length > 0 ? this[0].textContent : void 0;
				}
				else {
					for(const el of this){
						el.textContent = args[0];
					}
					return this;
				}
			};
			plist.empty = function(){
				for(const el of this){
					el.innerHTML = '';
				}
				return this;
			};
		}

		// CSS
		// classAdd, classRemove, classAdded, css, hide, unhide
		{
			plist.classAdd = plist.addClass = function(...class_list){
				for(const el of this){
					el.classList.add(...class_list);
				}
				return this;
			};
			plist.classRemove = plist.removeClass = function(...class_list){
				for(const el of this){
					el.classList.remove(...class_list);
				}
				return this;
			};
			plist.classAdded = plist.hasClass = function(class_name){
				return this[0] ? this[0].classList.contains(class_name) : false;
			};

			plist.css = function(...args_styles){
				let styles = null;
				if(1 === args_styles.length){
					if(null !== args_styles[0] && typeof(args_styles[0]) === 'object'){
						styles = args_styles[0];
					}
					else if(typeof(args_styles[0]) === 'string'){
						return getComputedStyle(this[0])[args_styles[0]];
					}
				}
				else if(2 === args_styles.length && typeof(args_styles[0]) === 'string'){
					styles = {
						[ args_styles[0] ]: args_styles[1]
					};
				}

				if(null === styles){
					throw new Error('Invalid arguments.');
				}

				for(const key in styles){
					let value = styles[key];
					if(typeof(value) === 'number'){
						value += 'px';
					}
					const key_css = dashedToCamel(key);

					for(const el of this){
						el.style[key_css] = value;
					}
				}

				return this;
			};

			plist.hide = function(){
				for(const el of this){
					el.style.display = 'none';
				}
				return this;
			};
			plist.unhide = function(){
				for(const el of this){
					el.style.display = '';
				}
				return this;
			};
		}

		// Attributes:
		// attr, attrRemove, prop, data, value
		{
			const getAttr = (el, name) => el.hasAttribute(name) ? el.getAttribute(name) : null;
			plist.attr = function(...args){
				let attrs = {};
				if(args[0] instanceof Object){
					attrs = args[0];
				}
				else if(typeof args[0] === 'string'){
					const [ name, value ] = args;
					if(1 === args.length){
						return this.length > 0 ? getAttr(this[0], name) : null;
					}
					else {
						attrs[name] = value;
					}
				}
				else {
					throw 0;
				}
				for(const el of this){
					for(const attr_name in attrs){
						el.setAttribute(attr_name, attrs[attr_name]);
					}
				}
				return this;
			};
			plist.attrAll = function(){
				const el = this[0];
				const attrs = {};
				for(const name of el.getAttributeNames()){
					const value = getAttr(el, name);
					if(value){
						attrs[name] = value;
					}
				}
				return attrs;
			};
			plist.attrRemove = plist.removeAttr = function(name){
				for(const el of this){
					el.removeAttribute(name);
				}
				return this;
			};

			plist.prop = function(...args){
				const [ name, value ] = args;
				if(1 === args.length){
					return this.length > 0 ? this[0][name] : void 0;
				}
				else {
					for(const el of this){
						el[name] = value;
					}
					return this;
				}
			};

			// data
			{
				const data_key = '$_datastorage';
				plist.data = function(...args){
					// const [ _name, value ] = args;
					// const name = dashedToCamel(_name);
					// if(1 === args.length){
					// 	return this.length > 0 && this[0][data_key] ? this[0][data_key].get(name) : void 0;
					// }
					// else {
					// 	for(const el of this){
					// 		if(!el[data_key]){
					// 			el[data_key] = new Map();
					// 		}
					// 		el[data_key].set(name, value);
					// 	}
					// 	return this;
					// }

					let datas = {};
					if(args[0] instanceof Object){
						datas = args[0];
					}
					else if(typeof args[0] === 'string'){
						const [ key, value ] = args;
						if(1 === args.length){
							return this.length > 0 && this[0][data_key] ? this[0][data_key].get(dashedToCamel(key)) : void 0;
						}
						else {
							datas[key] = value;
						}
					}
					else {
						throw 0;
					}
					for(const el of this){
						if(!el[data_key]){
							el[data_key] = new Map();
						}
						for(const key in datas){
							el[data_key].set(dashedToCamel(key), datas[key]);
						}
					}
					return this;
				};
				plist.dataRemove = plist.removeData = function(name){
					for(const el of this){
						if(el[data_key]){
							el[data_key].delete(name);
						}
					}
					return this;
				};
			}

			plist.value = plist.val = function(...args){
				if(0 === args.length){
					return this.length > 0 ? this[0].value : void 0;
				}
				else {
					for(const el of this){
						el.value = args[0];
					}
					return this;
				}
			};
		}

		// Events
		// on, one, off, trigger
		{
			const callbacks_storage = new Map();
			const op_bind = (op, els, args) => {
				// const { events, /* selector, callback_given, */ callback, options } = prepare(...args);
				const { events, selector, callback_given, options = {} } = parseOnArgs(...args);

				let callback = null;
				if('off' === op){
					callback = callbacks_storage.get(callback_given);
					callbacks_storage.delete(callback_given);
				}
				else {
					callback = function(ev){
						// if(null === selector || matchesSelector(ev.target, selector) || ev.target.$parents(selector).length > 0){
						// 	callback_given.call(this, ev);
						// }
						if(null === selector){
							callback_given.call(this, ev);
						}
						else {
							const current_targets = new Set();

							if(matchesSelector(ev.target, selector)){
								current_targets.add(ev.target);
							}

							for(const el_current_target of ev.target.$parents(selector)){
								current_targets.add(el_current_target);
							}

							for(const el_current_target of current_targets){
								callback_given.call(
									el_current_target,
									ev,
									{
										currentTarget: el_current_target
									}
								);
							}
						}
						if('one' === op){
							op_bind('off', els, args);
						}
					};
				}

				callbacks_storage.set(callback_given, callback);

				const listener_pref = ('off' === op ? 'remove' : 'add');
				op_do(els, listener_pref, events, callback, options);

				return els;
			};
			const op_do = (els, listener_pref, events, callback, options) => {
				for(const el of els){
					for(const ev of events){
						el[listener_pref + 'EventListener'](ev, callback, options);
					}
				}
			};
			pwin.on = function(...args){
				return op_bind('on', this, args);
			};
			pwin.one = function(...args){
				return op_bind('one', this, args);
			};
			pwin.off = function(...args){
				return op_bind('off', this, args);
			};

			const has_event_constructor_support = (() => {
				try {
					new Event('load');
					new CustomEvent('a');
					return true;
				}
				catch(e){
					return false;
				}
			})();
			const native_events = new Set(Object.keys(HTMLElement.prototype).filter(a => 'on' === a.substr(0, 2)).map(a => a.substr(2)));
			const createEvent = (name, detail = {}, options = {}) => {
				const is_native = native_events.has(name.toLowerCase());
				// console.log('is_native', is_native);

				const { bubbles = true, cancelable = true } = options;

				let ev;
				if(is_native){
					if(has_event_constructor_support){
						ev = new Event(name, { bubbles, cancelable });
					}
					else {
						ev = d.createEvent('HTMLEvents');
						ev.initEvent(name, bubbles, cancelable);
					}
				}
				else {
					if(has_event_constructor_support){
						ev = new CustomEvent(name, { bubbles, cancelable, detail });
					}
					else {
						ev = d.createEvent('CustomEvent');
						ev.initCustomEvent(name, bubbles, cancelable, detail);
					}
				}

				return ev;
			};
			pwin.trigger = function(name, detail){
				const ev = createEvent(name, detail);
				for(const el of this){
					el.dispatchEvent(ev);
				}
			};
		}

		// Service
		// feeeze
		{
			// returns static (non-live) copy of NodeList
			// "In some cases, the NodeList is live, which means that changes in the DOM automatically update the collection. For example, Node.childNodes is live"
			// https://developer.mozilla.org/en-US/docs/Web/API/NodeList
			plist.freeze = function(){
				return createNodeList(this);
			};
		}
	}

	// general functions
	const $man = (arg) => {
		if(typeof arg === 'string'){
			arg = arg.trim();
			if('<' === arg[0]){
				return parseHTML(arg);
			}
			else {
				return qselall(arg);
			}
		}
		else if(typeof arg === 'function'){
			if(d.attachEvent ? d.readyState === 'complete' : d.readyState !== 'loading'){
				arg();
			}
			else {
				d.addEventListener('DOMContentLoaded', arg);
			}
		}
		else if(arg instanceof class_element){
			return createNodeList([ arg ]);
		}
		else if(arg instanceof class_list){
			return arg;
		}
	};

	const def_man = (name, get) => {
		Object.defineProperty($man, name, { get });
	};

	def_man('parseHTML', () => parseHTML);

	def_man('head', () => d.head);
	def_man('body', () => d.body);

	const addMethod = (name, fn, fn_single, fn_window) => {
		name = '$' + name;

		fn = fn || fn_window;
		if(!fn_single){
			fn_single = function(...args){
				return fn.apply(createNodeList([ this ]), args);
			};
		}

		def(class_element.prototype, name, fn_single);
		def($man, name, fn_single.bind(el_html));
		def(class_list.prototype, name, fn);
		if(fn_window){
			def(w, name, fn_single.bind(w));
			def(d, name, fn_single.bind(d));
		}
	};

	for(const name in plist){
		addMethod(name, plist[name], pel[name]);
	}
	for(const name in pwin){
		addMethod(name, plist[name], pel[name], pwin[name]);
	}

	def_man('extend', () => (name, fn, fn_single) => {
		addMethod(name, fn, fn_single);
	});

	// mouseenter, mouseleave
	{
		const isSelfOrParentMatch = (el_given, selector) => {
			if(!el_given || !el_given.$is){
				return;
			}
			else if(el_given.$is(selector)){
				return el_given;
			}
			else {
				return el_given.$parents(selector)[0];
			}
		};
		const createFn = (els, name, ...args) => {
			const { selector, callback_given, options } = parseOnArgs('', ...args);

			const callback = (ev) => {
				// console.log(ev.target, ev.relatedTarget);
				const el_target = isSelfOrParentMatch(ev.target, selector);
				const el_related = isSelfOrParentMatch(ev.relatedTarget, selector);
				// console.log(el_target, el_related);
				if(el_target && el_target !== el_related){
					callback_given(ev);
				}
			};

			for(const el of els){
				el.addEventListener('mouse' + name, callback, options);
			}

			return els;
		};
		addMethod('onmouseenter', function(...args){
			return createFn(this, 'over', ...args);
		});
		addMethod('onmouseleave', function(...args){
			return createFn(this, 'out', ...args);
		});
	}

	w.$man = $man;
})();
