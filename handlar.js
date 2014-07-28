
if (!_)
	throw {name:'RequiresException', message:'Requires underscore.js'};


// Helper function to walk recursively through two objects, together.
// - callback: function(a,b,key,path)
function pairWalk(a,b,f)
{
	path = [];
	
	function rec(a,b,key)
	{
		if (typeof a === 'undefined' || typeof b === 'undefined')
			return;
		
		f(a,b,key,path);
		
		a = a[key];
		b = b[key];
		
		if (typeof a !== 'object' || typeof b !== 'object')
			return;
		
		var keys = _.union(Object.keys(a),Object.keys(b));
		keys.map(function(k)
		{
			path.push(k);
			rec(a,b,k);
			path.pop();
		});
	}
	
	var keys = _.union(Object.keys(a),Object.keys(b));
	
	keys.map(function(k)
	{
		path.push(k);
		rec(a,b,k);
		path.pop();
	});
}

// Perhaps the '.__' prefix can be changed to a random string, unique per
// page load.

Model = (function()
{
	// { All this up here
	
	// NOTE: These can be individual per Handle.  Why did I do it this way?
	var listeners = {};
	
	var special = Object.freeze({
		delete:{},
		R:{toString:function(){return 'R'}},
		RW:{toString:function(){return 'RW'}},
		RWD:{toString:function(){return 'RWD'}}
	});
	
	var modelId = _.uniqueId();
	
	// NOTE: Playing around with another private var.
	var onEvent = function(handle,eventName,func,args)
	{
		listeners[handle.__id][eventName].push({func:func,args:args});
	};
	
	var offEvent = function(handle,eventName,func)
	{
		var events = listeners[handle.__id][eventName]
		var funcs = events.map(function(a){return a.func});
		
		var index = funcs.indexOf(func);
		
		console.log(index,funcs);
		
		if (index >= 0)
			listeners[handle.__id][eventName].splice(index,1);
		
		return index >= 0;
	};
	
	function isHandle(a)
	{ return a.__id && listeners[a.__id]; }

	// 'a' is either an Array or one's descendant.
	function isArray(a)
	{
		var res = false;
		while (a != null && !(res=Array.isArray(a)))
			a = a.__proto__;
		return res;
	}
	
	function getArrayProto(a)
	{
		while (a != null && !Array.isArray(a))
			a = a.__proto__;
		return a;
	}
	
	function Handle(ob)
	{
		makeHandle(this,ob);
	}
	
	function ArrayHandle(ob)
	{
		makeHandle(this,ob);
	}
	ArrayHandle.prototype = Array.prototype;
	// }
	
	// NOTE: This belongs at the makeHandle level, somewhere before makeHandle.
	function setHandleProperty(handle,key,parentHandle)
	{
		console.log('setHandleProperty:',handle.$,key,parentHandle.$);
		
		if (!handle.__parent)
			Object.defineProperty(handle,'__parent',{
				enumerable:false,
				configurable:true,
				get:function(){ return parentHandle }
			});
		
		Object.defineProperty(handle,'__property',{
			enumerable:false,
			configurable:true,
			get:function(){ return key }
		});
		
		Object.defineProperty(parentHandle,key,{
			enumerable:true,
			configurable:true,
			get:function(){ return handle },
			set:function(val)
			{
				// Here, the recursion happens.
				makeHandle(handle,val,special.RWD);
			}
		});
	}
	
	// NOTE: callEvent is intended as an internal parameter.  The publicly
	//   visible $delete method will *always* call its topmost event listener
	//   functions.
	function deleteHandle(h,callEvent,eventRecurse,ind)
	{
		ind = (!ind ? 0 : ind);
		console.log('deleteHandle.'+ind+':',h,h.$,callEvent,eventRecurse);
		// Following its first call, deeper recursions will take eventRecurse
		// as this boolean check value.
		if (callEvent)
		{
			listeners[h.__id].delete.map(function(action)
			{ action.func(h.$) });
			
			listeners[h.__id].all.map(function(action)
			{ action.func('delete',[h.$]) });
		}
		
		var todel = [];
		Object.getOwnPropertyNames(h).map(function(x)
		{
			if (isHandle(h[x]) && h[x] !== h.__parent)
				// Recursion, here.
				deleteHandle(h[x],eventRecurse,(callEvent&&eventRecurse),ind+1);
			else
				todel.push(x);
		});
		
		delete listeners[h.__id];
		
		if (h.__parent)
		{
			// NOTE: Here, the ob-removal refactoring will come into play.
			h.__parent.__expose();
			delete h.__parent[h.__property];
			delete h.__parent.__ob[h.__property];
			h.__parent.__conceal();
		}
		
		todel.map(function(x){ delete h[x]; });
	}
	
	// NOTE: I want these Handle objects to remain *independent* of Model
	//   instances, though...  Will think through, later.
	//
	// NOTE: The parameter flags is present, here, and is intended for the R, RW,
	//   RWD enums, although those aren't really flags at all (at least not in the
	//   sense of the typical binary and-able flag).
	function makeHandle(handle,ob,flags)
	{
		// NOTE: Putting this here, for now.
		//
		// NOTE: This effectively *orphans* a Handle.  This should not happen,
		//   except to be followed by one of two cases:
		//
		//   1) orphaned Handle is then assigned as another property under
		//      another parent Handle.
		//   2) orphaned Handle has '$delete()' called upon itself, and is removed
		//      from all states of natural be-ing.
		if (isHandle(handle) && isHandle(ob))
		{
			setHandleProperty(ob,handle.__property,handle.__parent);
			delete handle.__parent;
			delete handle.__property;
			return ob;
		}
		
		flags = (typeof flags === 'undefined' ? special.RWD : flags);
		var self = handle;
		
		console.log('point Zero:',handle.$);
		
		// Array... what about arrays?  What was I doing here, again?
		if (isArray(handle) != isArray(ob))
			throw {
				name:'MismatchedParameterTypesException',
				message:'handle and ob must both be Arrays if either is.'
			};
		
		// NOTE: Shouldn't need any modification on ob, if it is to be treated in
		//   an immutable, read-only manner.
		//ob = (typeof ob === 'object' ?
		//     (Array.isArray(ob) ? ob.slice() : _.extend({},ob)): ob)
		
		console.log('ob is:',ob);
		
		// Assign these values only if handle has not yet been instantiated.
		if (!isHandle(handle))
		{
			// Assign immutable id.
			Object.defineProperty(handle,'__id',{
				enumerable:false,
				configurable:false,
				writable:false,
				value:modelId+'_'+_.uniqueId()
			});
			
			// Add listeners entry, with arrays of event callbacks.
			//
			// NOTE: In the event that the listeners object is moved to a private,
			//   per-Handle var, this... will likely not change much, now that I
			//   think about it.
			listeners[handle.__id] = {change:[],delete:[],all:[],add:[],sort:[]};
			
			// Assign add-event-listener function.
			Object.defineProperty(handle,'$on',{
				enumerable:false,
				configurable:false,
				value:function(eventName,func,args)
				{ onEvent(self,eventName,func,args); }
			});
			
			// Assign remove-event-listener function.
			Object.defineProperty(handle,'$off',{
				enumerable:false,
				configurable:false,
				value:function(eventName,func)
				{ return offEvent(self,eventName,func); }
			});
			
			Object.defineProperty(handle,'$delete',{
				enumerable:false,
				configurable:true,
				writable:false,
				value:function(eventRecurse)
				{
					eventRecurse = (typeof eventRecurse !== 'undefined' ?
						eventRecurse : false);
					deleteHandle(self,true,eventRecurse);
				}
			});
		}
		
		
		if (typeof ob === 'object')
		{
			// Array.
			if (isArray(ob))
			{
				// $
				Object.defineProperty(handle,'$',{
					enumerable:false,
					configurable:false,
					get:function()
					{
						var ret = [];
						for (var i=0; i < this.length; ++i)
							ret.push(this[i].$);
						return ret;
					}
				});
				
				// $type
				Object.defineProperty(handle,'$type',{
					enumerable:false,
					configurable:false,
					get:function(){ return 'array'; }
				});
				
				// $modify
				Object.defineProperty(handle,'$modify',{
					enumerable:false,
					configurable:false,
					get:function(){ return undefined; }
				});
				
				// NOTE: *Should* read methods be overridden?  Ought it not be enough to
				//   perform such methods with the results of a '$' call?
				// 
				// { Overrides
				//
				// { Override read methods.
				//   NO EVENTS FIRED
				// 
				// concat
				// every
				// filter
				// 
				// indexOf
				// join
				// keys
				// lastIndexOf
				// 
				// slice
				// some
				//
				// toLocaleString
				// toString
				
				// NOTE: These merely call their Array.prototype selves upon 'this.$'.
				//   It is then more efficient in code to simply store the result of
				//   '$', and call subsequent functions off that.
				['concat','every','filter','indexOf','join','keys',
				 'lastIndexOf','slice','some','toLocaleString','toString']
					.map(function(property)
					{
						Object.defineProperty(handle,property,{
							enumerable:false,
							configurable:true,
							value:function()
							{	return Array.prototype[property].apply(this.$,arguments); }
						});
					});

				// }
				
				// { Override sort methods.
				//   SORT EVENT FIRED
				//
				// reverse
				// sort
				// 

				Object.defineProperty(handle,'reverse',{
					enumerable:false,
					configurable:true,
					value:function()
					{
						// NOTE: This isn't working.  I'm thinking it has something to do
						//   with property assigns, since these were defined with
						//   getters/setters, rather than simply 'a[i] = b'.
						//Array.prototype.reverse.apply(this);
						var halflen = this.length >> 1;
						for (var i=0; i < halflen; ++i)
						{
							var j = this.length-1-i;
							var a = this[i];
							var b = this[j];
							setHandleProperty(a,j,a.__parent);
							setHandleProperty(b,i,a.__parent);
						}
						
						var self = this;
						console.log('self/this:',self.$);
						listeners[this.__id].sort.map(function(a)
						{
							console.log('come on...',self,self.$);
							a.func(self.$,a.args);
						});
						
						return this;
					}
				});
				
				Object.defineProperty(handle,'sort',{
					enumerable:false,
					configurable:true,
					value:function(compareFunction)
					{
						// Calling '$' in the compareFunction directly would call the full
						// '$' traversal for every entry in the sort function's algorithm
						// efficiency... method...  Ah, what are the words I seek?
						var arr = Array.prototype.map.call(this,function(a)
						{ return {h:a,$:a.$} });
						
						arr.sort(function(a,b)
						{
							console.log('compare:',a,b);
							return compareFunction(a.$,b.$);
						});
						
						// WARNING: This relies on '= Handle', which presently throws an
						//   exception.
						//
						// ASSUME: __property is assigned on '= Handle'.
						for (var i in arr)
							//this[i] = arr[i].h;
							setHandleProperty(arr[i].h,i,this);
						
						var self = this;
						listeners[this.__id].sort.map(function(a)
						{ a.func(self.$,a.args); });
					}
				});
				
				// }
				
				// { Override add methods.
				//   ADD EVENT FIRED
				//
				// push
				// * splice
				// unshift
				// 
				
				Object.defineProperty(handle,'push',{
					enumerable:false,
					configurable:true,
					value:function() // WAIT!  This ought be v1,v2,...,vn
					{
						for (var i in arguments)
						{
							var val = arguments[i];
							var h;
							
							// Handle
							// 
							// WARNING: '= Handle' hasn't been fully thought through.
							if (isHandle(val))
								h = val;
							
							// non-Handle
							else
								h = makeHandle((isArray(val) ? [] : {}),val,flags);
							
							var property = this.length;
							
							Array.prototype.push.call(this,h);
							setHandleProperty(h,property,handle);
							
							listeners[this.__id].add.map(function(a)
							{ a.func(val,property,a.args); });
						}
						return this.length;
					}
				});
				
				Object.defineProperty(handle,'unshift',{
					enumerable:false,
					configurable:true,
					value:function() // WAIT!  This ought be v1,v2,...,vn
					{
						for (var i in arguments)
						{
							var val = arguments[i];
							var h;
							
							// Handle
							// 
							// WARNING: '= Handle' hasn't been fully thought through.
							if (isHandle(val))
								h = val;
							
							// non-Handle
							else
								h = makeHandle((isArray(val) ? [] : {}),val,flags);
							
							Array.prototype.unshift.call(this,h);
							setHandleProperty(h,0,handle);
							
							listeners[this.__id].add.map(function(a)
							{ a.func(val,0,a.args); });
						}
						return this.length;
					}
				});
			
				//
				// }

				// { Override remove methods.
				//   REMOVE EVENT FIRED
				//
				// pop
				// shift
				// * splice
				//
				// }

				// { Override accessor methods.
				//   EVENTS?
				// 
				// forEach
				// map
				// reduce
				// recudeRight
				//
				// }
				//
				// }
				
				// NOTE: Ah, wait, gotta do the property sets bit for add/delete/change.
				var hKeys = Object.keys(handle);
				var oKeys = Object.keys(ob).filter(
				function(k){ return typeof ob[k] !== 'undefined' });
			
				var hnoto = _.difference(hKeys,oKeys);
				var hando = _.intersection(hKeys,oKeys);
				var onoth = _.difference(oKeys,hKeys);
		
				// Add properties.
				if (flags === special.RW || flags === special.RWD)
					onoth.map(function(p)
					//for (var i in ob)
					{
						handle.push(ob[p]);
					});
				
				// Delete propreties.
				if (flags === special.RWD)
					hnoto.map(function(p)
					{
						
					});
			}
			
			// Object.
			else
			{
				// $
				// $type
				// $modify
				// Add properties.
				// Delete properties.
			}
			
			// Change properties.
		}
		else
		{
			// Primitive.
			
			// $
			Object.defineProperty(handle,'$',{
				enumerable:false,
				configurable:true,
				get:function()
				{
					return ob;
				}
			});
			
			// $type
			// $modify
		}
		
		/*
		// Old Stuff {
		return handle;
		
		// Assign basic JSON-object export function.
		Object.defineProperty(handle,'$',{
			enumerable:false,
			configurable:true,
			get:function()
			{
				//console.log('$   $:',ob);
				if (typeof ob !== 'object')
					return ob;
				
				var ret = (Array.isArray(ob) ? [] : {});
				for (var p in ob)
					ret[p] = ob[p].$;
				//console.log('the $:',ret);
				return ret;
			}
		});
		
		Object.defineProperty(handle,'$modify',{
			enumerable:false,
			configurable:true,
			writable:false,
			value:function(b,flags)
			{
				flags = (typeof flags === 'undefined' ? special.RW : flags);
				makeHandle(this,b,flags);
			}
		});
		
		if (typeof ob !== 'object')
		{
			// NOTE: Looks like defining properties on Number/String/Boolean is
			//   considered acting on primitives, and is not permitted.  Guess
			//   creating unique literal value Handles won't be possible.
			
			Object.defineProperty(handle,'valueOf',{
				enumerable:false,
				configurable:true,
				value:function(){ console.log('val?',ob); return ob; }
			});
			
			// NOTE: Wait, do I need to define these?  Aren't they inherited from
			//   Object type?  A simple assign should do, should it not?
			Object.defineProperty(handle,'toString',{
				enumerable:false,
				configurable:true,
				value:function(){ console.log('str?',ob); return ob.toString(); }
			});
		}
		
		if (typeof ob === 'object')
		{
			// Modify all.
			
			// NOTE: Hmm.....  Regarding *modify all*, there are several cases:
			// 	 1) handle[p] exists, and is being [changed]
			// 	 2) handle[p] does *not* exist, and is being created
			// 	 3) handle[p] exists, but ob[p] does *not*, and so it is [deleted]
			
			var hKeys = Object.keys(handle);
			var oKeys = Object.keys(ob).filter(
				function(k){ return typeof ob[k] !== 'undefined' });
			
			var hnoto = _.difference(hKeys,oKeys);
			var hando = _.intersection(hKeys,oKeys);
			var onoth = _.difference(oKeys,hKeys);
			
			console.log('bah:',handle,ob);
			console.log('these two:',hKeys,oKeys);
			console.log('these three:',hnoto,hando,onoth);
			
			console.log('flags:',flags);
			console.log('point A:',handle.$);
			
			if (flags == special.RWD)
				// Deleting... <- hnoto
				hnoto.map(function(p)
				{
					var h = handle[p];
					console.log('deleting:',h,h.$);
					
					deleteHandle(h,true,true);
				});
			
			console.log('point B:',handle.$);
			
			if (flags == special.R || flags == special.RW || flags == special.RWD)
				// Changing... <- hando
				hando.map(function(p)
				{
					// NOTE: REMEMBER, in each of these cases, hnoto, hando, and onoth,
					//   *both* handle[p] *and* the local ob[p] must be modified.
					var oldValue = handle[p].$;
					
					console.log('changing from',oldValue);
					
					makeHandle(handle[p],ob[p],flags);
					ob[p] = handle[p];
					
					var newValue = handle[p].$;
					
					console.log('changing changed:',oldValue,newValue);
					
					// Run 'change' event listeners.
					listeners[handle[p].__id].change.map(function(action)
					{
						action.func(newValue,oldValue,action.args);
					});
				
					// Run 'all' event listeners.
					listeners[handle[p].__id].all.map(function(action)
					{
						action.func('change',[newValue,oldValue,action.args]);
					});
						
				});
			
			console.log('point C:',handle.$);
			
			if (flags == special.RW || flags == special.RWD)
				// Adding... <- onoth
				onoth.map(function(p)
				{
					ob[p] = new Handle(ob[p]);
					
					Object.defineProperty(ob[p],'__parent',{
						enumerable:false,
						configurable:false,
						get:function(){return handle}
					});
					Object.defineProperty(ob[p],'__property',{
						enumerable:false,
						configurable:false,
						writable:false,
						value:p
					});
			
					Object.defineProperty(handle,p,{
						enumerable:true,
						configurable:true,
						get:(function(k){return function(){return ob[k]}})(p),
						set:(function(k){return function(val)
						{ handleSet(val,k); }})(p)
					});
				});
			
			console.log('point D:',handle.$);
			
			function handleSet(val,k)
			{
				var oldHandle = ob[k];
				var newHandle;
				//console.log('handleSet()',val,k,oldHandle);
				
				// Store old value before possible modification, if it will have a
				// use, later on.
				var oldValue;
				if (listeners[oldHandle.__id].change.length > 0 ||
						listeners[oldHandle.__id].all.length > 0)
					oldValue = oldHandle.$;
				
				// NOTE: Should 'change' only be called if the value has, in fact,
				//   changed?
				
				// Assign newHandle.
				if (isHandle(val))
				{
					// Replace.
					//newHandle = val;
					throw {
						name:'BlockingThisForNowException',
						message:'For now, no replacement.'
					};
				}
				else if (typeof val === 'object')
				{
					newHandle = makeHandle(oldHandle,val,flags);
				}
				else
				{
					newHandle = makeHandle(oldHandle,val,flags);
				}
				
				// Adopt oldHandle's listeners.
				if (newHandle !== oldHandle)
				{
					_.extend(listeners[newHandle.__id],listeners[oldHandle.__id]);
					delete listeners[oldHandle.__id];
				}
				
				// Run 'change' event listeners.
				listeners[newHandle.__id].change.map(function(action)
				{
					action.func(val,oldValue,action.args);
				});
			
				// Run 'all' event listeners.
				listeners[newHandle.__id].all.map(function(action)
				{
					action.func('change',[val,oldValue,action.args]);
				});
				
				//console.log('ob['+k+'] =',newHandle);
				ob[k] = newHandle;
				
				return newHandle;
			}	
		}	
		// }
		//*/
		
		//console.log('final ob:',ob);
		
		return handle;
	}
	
	function Model(params)
	{
		var Model = {};
		
		if (params)
		{
			
		}
		
		this.R = special.R;
		this.RW = special.RW;
		this.RWD = special.RWD;
		
		this.Handle = Handle;
		this.ArrayHandle = ArrayHandle;
		
		this.makeHandle = makeHandle;	
		
		Object.defineProperty(this,'listeners',{
			enumerable:true,
			configurable:false,
			writable:false,
			value:function()
			{
				var ret = {};
				for (var p in listeners)
				{
					var events = {};
					for (var k in listeners[p])
						events[k] = listeners[p][k].map(function(a){return _.extend({},a)});
					ret[p] = events;
				}
				return ret;
			}
		});
	};

	return Model;
})();


