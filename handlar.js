
if (!_)
	throw {name:'RequiresException', message:'Requires underscore.js'};


	// Helper function to walk recursively through two objects, together.
	// - callback: function(a,b,key,path)
	var pairWalkRec = function pairWalkRec(a,b,path,callback)
	{
		if (typeof b === 'undefined')
			return;
		
		for (var p in a)
		{
			path.push(p);
			callback(a,b,p,path);
			
			pairWalkRec(a[p],b[p],path,callback);
			path.pop();
		}
	};
	
	var pairWalk = function(a,b,callback)
	{
		for (var p in a)
		{
			pairWalkRec(a,b,[],callback);
		}
	}
// Perhaps the '.__' prefix can be changed to a random string, unique per
// page load.

Model = (function()
{
	// NOTE: These can be individual per Handle.  Why did I do it this way?
	var listeners = {};
	
	var special = {
		delete:{}
	};
	
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
	
	
	function Handle(ob)
	{
		makeHandle(this,ob);
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
			if (h[x] instanceof Handle && h[x] !== h.__parent)
				// Recursion, here.
				deleteHandle(h[x],eventRecurse,(callEvent&&eventRecurse),ind+1);
			else
				todel.push(x);
		});
		
		delete listeners[h.__id];
		
		if (h.__parent)
		{
			h.__parent.__expose();
			delete h.__parent[h.__property];
			delete h.__parent.__ob[h.__property];
			h.__parent.__conceal();
		}
		
		todel.map(function(x){ delete h[x]; });
	}
	
	// NOTE: I want these Handle objects to remain *independent* of Model
	//   instances, though...  Will think through, later.
	function makeHandle(handle,ob)
	{
		var self = handle;
		var handle = handle;
		
		// ob effectively holds a mirror copy of... everthing.  There's a reason I'm
		// using it, and testing has revealed that reason as valid.  But exactly what
		// is that reason...?  Was it the leaf node Handles?
		ob = (typeof ob === 'object' ?
				(Array.isArray(ob) ? ob.slice() : _.extend({},ob)): ob)
		
		// Assign these values only if handle has not yet been instantiated.
		if (!handle.__id)
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
			listeners[handle.__id] = {change:[],delete:[],all:[]};
			
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
			
		}
		
		// NOTE: __expose and __conceal are HACKS.  These shouldn't be necessary,
		//   but it turns out the ob[k] get override requires the *parent's* local
		//   'ob' variable, too.  At least for the delete.  This is happening,
		//   because I chose for $delete to be called from the Handle being
		//   deleted, and not its parent, deleting its child.  I may choose to
		//   revise this, later.
		Object.defineProperty(handle,'__expose',{
			enumerable:false,
			configurable:true,
			writable:false,
			value:function()
			{
				this.__ob = ob;
			}
		});
		
		Object.defineProperty(handle,'__conceal',{
			enumerable:false,
			configurable:true,
			writable:false,
			value:function()
			{
				delete this.__ob;
			}
		});
	
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
		
		Object.defineProperty(handle,'$modify',{
			enumerable:false,
			configurable:true,
			writable:false,
			value:function(b)
			{
				for (var p in b)
				{
					
				}
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
			
			//console.log('bah:',handle,ob);
			//console.log('these two:',hKeys,oKeys);
			//console.log('these three:',hnoto,hando,onoth);
			
			// Deleting... <- hnoto
			hnoto.map(function(p)
			{
				var h = handle[p];
				console.log('deleting:',h,h.$);
				
				deleteHandle(h,true,true);
			});
			
			// Changing... <- hando
			hando.map(function(p)
			{
				// NOTE: REMEMBER, in each of these cases, hnoto, hando, and onoth,
				//   *both* handle[p] *and* the local ob[p] must be modified.
				
				var oldValue = handle[p].$;
				
				makeHandle(handle[p],ob[p]);
				ob[p] = handle[p];
				
				var newValue = handle[p].$;
				
				//console.log('changing changed:',oldValue,newValue);
				
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
				if (val instanceof Handle)
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
					newHandle = makeHandle(oldHandle,val);
				}
				else
				{
					newHandle = makeHandle(oldHandle,val);						
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
		
		//console.log('final ob:',ob);
		
		return handle;
	}
	
	function Model(params)
	{
		var Model = {};
		
		if (params)
		{
			
		}
		
		this.Handle = Handle;
		
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


