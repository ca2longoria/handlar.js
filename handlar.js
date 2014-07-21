
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
	//
	// NOTE: The parameter flags is present, here, and is intended for the R, RW,
	//   RWD enums, although those aren't really flags at all (at least not in the
	//   sense of the typical binary and-able flag).
	function makeHandle(handle,ob,flags)
	{
		flags = (typeof flags === 'undefined' ? special.RWD : flags);
		var self = handle;
		
		console.log('point Zero:',handle.$);
		
		// ob effectively holds a mirror copy of... everthing.  There's a reason I'm
		// using it, and testing has revealed that reason as valid.  But exactly what
		// is that reason...?  Was it the leaf node Handles?
		//
		// NOTE: ob is 'overwritten', here.  Perhaps, depending on the provided
		//   flags, ob can be an extension of __expand(), __ob, __conceal().  The
		//   only thing, *then*, is that 'flags' will be used in two separate
		//   places, independant of $modify or makeHandle.
		//
		// NOTE: AAAHRGH!  This is a nasty mess!  I need to remove the ob/handle
		//   duality.  There's no way I progress properly like this!
		if (handle instanceof Handle && handle.__id && typeof ob === 'object')
		{
			var nob = (typeof ob === 'object' ?
				(Array.isArray(ob) ? ob.slice() : _.extend({},ob)): ob);
			
			handle.__expose();
			// RW
			if (typeof handle.__ob === 'object' && flags == special.RW)
				ob = _.extend(handle.__ob,nob);
			// R
			else if (flags == special.R)
			{
				if (typeof nob === 'object' && typeof handle.__ob === 'object' &&
				    !Array.isArray(nob) && !Array.isArray(handle.__ob))
				{
					console.log('R, nob:',nob);
					_.extend(nob,handle.__ob);
					console.log('   nob:',nob);
					pairWalk(nob,handle.__ob,function(a,b,k,path)
					{
						console.log('pair walk:',a,b,k,path);
						if (typeof b[k] === 'undefined')
							delete a[k];
					});
				}
				ob = nob;
			}
			// RWD
			else
				ob = _.extend({},nob);
			handle.__conceal();
		}
		else
			ob = (typeof ob === 'object' ?
			     (Array.isArray(ob) ? ob.slice() : _.extend({},ob)): ob)
		
		console.log('ob is:',ob);
		
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


