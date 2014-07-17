
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
		
		// Assign basic JSON-object export function.
		Object.defineProperty(handle,'$',{
			enumerable:false,
			configurable:true,
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
		{
			// NOTE: Looks like defining properties on Number/String/Boolean is
			//   considered acting on primitives, and is not permitted.  Guess
			//   creating unique literal value Handles won't be possible.
			
			Object.defineProperty(handle,'valueOf',{
				enumerable:false,
				configurable:true,
				value:function()
				{ console.log('val?',ob); return ob; }
			});
		}
		
		if (typeof ob === 'object')
		for (var p in ob)
		{
			//ob[p] = (typeof ob[p] === 'object' ? new Handle(ob[p]) : ob[p]);
			//ob[p] = new Handle(ob[p]);
			
			console.log('ob[p]',[ob,p,ob[p],ob[p].__id]);
			// NOTE: If going for soft overwrites, this, too, needs to be a call to
			//   makeHandle, rather than new Handle(...).  Unless this is only ever
			//   accessed at creation, and not on assign.  One moment...
			if (handle[p] instanceof Handle)
				ob[p] = makeHandle(handle[p],ob[p]);
			else
				ob[p] = new Handle(ob[p]);
			
			if (handle[p] != ob[p])
			{
				Object.defineProperty(ob[p],'__parent',{
					enumerable:false,
					configurable:false,
					get:function(){return handle}
				});
			
				// NOTE: Put this here for private access to its parent while
				//   retaining its given property name.
				
				Object.defineProperty(ob[p],'$delete',{
					enumerable:false,
					configurable:false,
					value:(function(k){return function(){ self[k] = special.delete }})(p)
				});
			}
			
			Object.defineProperty(handle,p,{
				enumerable:true,
				configurable:true,
				get:(function(k){return function(){return ob[k]}})(p),
				set:(function(k){return function(val)
				{
					var oldHandle = ob[k];
					var newHandle;
					
					if (val == special.delete)
					{
						// NOTE: Deletion needs to go somewhere more accissible.  Now that
						//   there's a proper $delete method, this ought go somewhere more
						//   sensible.
						
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
						//
						//   You know what?  This is all based on the idea of a unified
						//   object model, meaning there is only *one* root object for
						//   each of these.  Modifying a Handle *should* invalidate all
						//   the Handles below it. 
						//*
						for (var x in oldHandle)
							if (oldHandle[x] instanceof Handle)
								oldHandle[x] = special.delete;
						//*/
						
						// NOTE: There is another concern, however.  In the event that a
						//   Handle is assigned another object structure, creating more
						//   handles, ought paths/values matching between the recursed
						//   deleted old and the new created Handle be applied to the new,
						//   as well?
						//
						//   By values, I mean things held by private Model vars,
						//   like the listeners object.
						//
						//   Ultimately, that depends on whether the object is being
						//   *replaced* or *modified*.  How might we distinguish between
						//   the two?
						//
						//   Maybe... replace = new M.Hanlde({}), modify = {}.
						//   Or visa-versa.  Could work either way.
						//
						//   Save this for a later commit.  Or better yet, make a github
						//   Issue.
						
						// Remove events from listeners object.
						delete listeners[oldHandle.__id];
						delete ob[k];
						delete self[k];
						return;
					}
					
					// Get old value only if it will be necessary later on in calling
					// listeners.
					var oldValue;
					if (listeners[oldHandle.__id].change.length > 0 ||
					    listeners[oldHandle.__id].all.length > 0)
						oldValue = oldHandle.$;
					
					// NOTE: Replace-vs-Modify logic will have to change this, here.
					//newHandle = (val instanceof Handle ? val : new Handle(val));
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
						// Modify.
						//newHandle = new Handle(val);
						newHandle = makeHandle(oldHandle,val);
						
						/* If not replacing oldHandle, the external data need not
						   be removed.
						   
						// Recursively transfer listeners.
						// 
						// NOTE: Seems to work, but on thinking over it, again, perhaps
						//   passing in a regular object should traverse that regular
						//   object *alone*, and modify oldHandle *without* replacing it,
						//   entirely.  I'll think it over.  For now, it effectively does
						//   already what I made it to do, so all's good.
						pairWalk(oldHandle,newHandle,function(old,newh,key,path)
						{
							console.log('hokay!',key,old[key],newh[key]);
							
							if (newh[key])
								_.extend(listeners[newh[key].__id],listeners[old[key].__id]);
							delete listeners[old[key].__id];
						});
						//*/
					}
					else
						//newHandle = new Handle(val);
						newHandle = makeHandle(oldHandle,val);
					
					// Modify listeners object.
					// - Copy oldHandle's listeners over to newHandle's.
					// - Remove oldHandle's listeners. 
					if (newHandle !== oldHandle)
					{
						_.extend(listeners[newHandle.__id],listeners[oldHandle.__id]);
						delete listeners[oldHandle.__id];
					}
					
					ob[k] = newHandle;
					
					if (oldValue)
					{
						// Run change event listeners.
						listeners[ob[k].__id].change.map(function(action)
						{
							action.func(val,oldValue,action.args);
						});
					
						// Run 'all' event listeners.
						listeners[ob[k].__id].all.map(function(action)
						{
							action.func('change',[val,oldValue,action.args]);
						});
					}
					
					// Should events also bubble up...?
					
					console.log('returning',ob[k]);
					return ob[k];
				}})(p)
			});
		}
		
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


