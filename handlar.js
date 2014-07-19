
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
			
			// NOTE: Disable this, for the moment, while I refactor.
			if (false)
			for (var p in ob)
			{
				//ob[p] = (typeof ob[p] === 'object' ? new Handle(ob[p]) : ob[p]);
				//ob[p] = new Handle(ob[p]);
				
				console.log('ob[p]',[ob,p,ob[p],ob[p].__id]);
				
				
				// NOTE: If going for soft overwrites, this, too, needs to be a call to
				//   makeHandle, rather than new Handle(...).  Unless this is only ever
				//   accessed at creation, and not on assign.  One moment...
				if (handle[p] instanceof Handle)
				{
					ob[p] = makeHandle(handle[p],ob[p]);
				}
				else
					ob[p] = new Handle(ob[p]);
				
				if (handle[p] != ob[p])
				{
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
				
					// NOTE: Put this here for private access to its parent while
					//   retaining its given property name.
					Object.defineProperty(ob[p],'$delete',{
						enumerable:false,
						configurable:false,
						// NOTE: eventRecurse calls delete event for all descendants.
						value:(function(k,eventRecurse)
						{return function(){ self[k] = special.delete }})(p)
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
							console.log('deleting:',oldHandle.$);
							
							listeners[oldHandle.__id].delete.map(function(action)
							{
								action.func(oldHandle.$);
							});
							
							listeners[oldHandle.__id].all.map(function(action)
							{
								action.func('delete',[oldHandle.$]);
							});
							
							/*
							for (var x in oldHandle)
								if (oldHandle[x] instanceof Handle)
									oldHandle[x] = special.delete;
							//*/
							//*
							Object.getOwnPropertyNames(oldHandle).map(function(x)
							{
								if (oldHandle[x] instanceof Handle)
									oldHandle[x] = special.delete;
								else
									delete oldHandle[x];
							});
							//*/
							
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


