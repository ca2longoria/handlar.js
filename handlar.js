
if (!_)
	throw {name:'RequiresException', message:'Requires underscore.js'};


// Perhaps the '.__' prefix can be changed to a random string, unique per
// page load.

Model = (function()
{
	// NOTE: These can be individual per Handle.  Why did I do it this way?
	var listeners = {};
	
	var special = {
		delete:{}
	};
	
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
	
	// NOTE: I want these Handle objects to remain *independent* of Model
	//   instances, though...  Will think through, later.
	function Handle(ob)
	{
		var self = this;
		var handle = this;
		
		// ob effectively holds a mirror copy of... everthing.  There's a reason I'm
		// using it, and testing has revealed that reason as valid.  But exactly what
		// is that reason...?  Was it the leaf node Handles?
		ob = (typeof ob === 'object' ?
				(Array.isArray(ob) ? ob.slice() : _.extend({},ob)): ob)
		
		Object.defineProperty(this,'__id',{
			enumerable:false,
			configurable:false,
			writable:false,
			value:_.uniqueId()
		});
		
		// Add listeners entry, with arrays of event callbacks.
		listeners[this.__id] = {change:[],delete:[],all:[]};
		
		Object.defineProperty(this,'$on',{
			enumerable:false,
			configurable:false,
			value:function(eventName,func,args)
			{ onEvent(self,eventName,func,args); }
		});
		
		Object.defineProperty(this,'$off',{
			enumerable:false,
			configurable:false,
			value:function(eventName,func)
			{
				return offEvent(self,eventName,func);
			}
		});
		
		Object.defineProperty(this,'$',{
			enumerable:false,
			configurable:false,
			get:function()
			{
				if (typeof ob !== 'object')
					return ob;
				
				var ret = (Array.isArray(ob) ? [] : {});
				for (var p in ob)
					ret[p] = ob[p].$;
				return ret;
			}
		});
		
		if (typeof ob !== 'object')
			this.valueOf = function()
			{ console.log('val?',ob); return ob; };
		
		if (typeof ob === 'object')
		for (var p in ob)
		{
			//ob[p] = (typeof ob[p] === 'object' ? new Handle(ob[p]) : ob[p]);
			ob[p] = new Handle(ob[p]);
			ob[p].__parent = this;
			
			// NOTE: Put this here for private access to its parent while
			//   retaining its given property name.
			Object.defineProperty(ob[p],'$delete',{
				enumerable:false,
				configurable:false,
				value:(function(k){return function(){ self[k] = special.delete }})(p)
			});
			
			Object.defineProperty(this,p,{
				enumerable:true,
				configurable:true,
				get:(function(k){return function(){return ob[k]}})(p),
				set:(function(k){return function(val)
				{
					var oldHandle = ob[k];
					var newHandle;
					
					if (val == special.delete)
					{
						// NOTE: Deletion needs to go somewhere more accissible.
						
						listeners[oldHandle.__id].delete.map(function(action)
						{
							action.func(oldHandle.$);
						});
						
						listeners[oldHandle.__id].all.map(function(action)
						{
							action.func('delete',[oldHandle.$]);
						});
						
						// NOTE: WAAAAIT!
						//   This must recurse.  It needs to recurse.
						//   Or does it?  What if something else is using these?
						/*
						for (var x in oldHandle)
							if (oldHandle[x] instanceof Handle)
								oldHandle[x] = special.delete;
						//*/
						
						// Remove events from listeners object.
						delete listeners[oldHandle.__id];
						delete ob[k];
						delete self[k];
						return;
					}
					
					newHandle = (val instanceof Handle ? val : new Handle(val));
					ob[k] = newHandle;
					
					// Modify listeners object.
					// - Copy oldHandle's listeners over to newHandle's.
					// - Remove oldHandle's listeners. 
					_.extend(listeners[newHandle.__id],listeners[oldHandle.__id]);
					delete listeners[oldHandle.__id];
					
					// Run change event listeners.
					listeners[ob[k].__id].change.map(function(action)
					{
						action.func(val,oldHandle.$,action.args);
					});
					
					// Run 'all' event listeners.
					listeners[ob[k].__id].all.map(function(action)
					{
						action.func('change',[val,oldHandle.$,action.args]);
					});
					
					// Should events also bubble up...?
					
					console.log('returning',ob[k]);
					return ob[k];
				}})(p)
			});
		}
	}
	
	function Model(params)
	{
		var Model = {};
		
		this.on = function(handle,eventName,func,args)
		{
			//listeners[handle.__id][eventName].push({func:func,args:args})
			handle.$on(eventName,func,args);
		};
		
		if (params)
		{
			
		}
		
		this.Handle = Handle;
		
		Object.defineProperty(this,'Delete',{
			enumerable:false,
			configurable:false,
			writable:false,
			value:special.delete
		});
		
	};

	return Model;
})();

