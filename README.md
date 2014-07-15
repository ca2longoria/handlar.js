
###handlar.js

Simple MVC without the V or the C.

- Simple JSON object event handling library.
- Inspired by the idea of a client-side unified object model.
- And on realizing _backbone.js_ has way more complexity than I need.

---

#### Dependencies
- underscore.js
- _.defineProperty_-compatible browser

---

#### Object Structure

- **Model**
    - on : _function_
    - Delete : _object/enum_
    - **Handle**
        - $ : _function_
        - $on : _function_
        - $off : _function_
        - \<property\>... : _Handle_

---

#### Examples

##### Object Instantiation

```javascript
M = new Model();

handle = new M.Handle({
    a: 1,
    b: {
        x:'X',
        y:'Y'
    }
});
```

##### JSON Object
```javascript
handle.a.$
-> 1
handle.b.$
-> {x:'X',y:'Y'}
handle.b.x.$
-> "X"
```

===

##### Event Handling
#####Event: `change`
```javascript
handle.a.$on('change',function(val,old){console.log('change! '+old+'=>'+val)})
handle.a = 3
-> change! 1 => 3
```

##### Event: `delete`
```javascript
// This one is pretty strange.  I'm still mulling over how to do this properly,
// since *delete* can't be overridden.
handle.a.$on('delete',function(old){console.log('delete! '+old)})
handle.a = M.Delete
-> delete! 3

// And now it looks like...
handle.$
-> {b:{x:'X',y:'Y'}}
```

##### Event removal
```javascript
// Some setup
q = function(){console.log('All is transient')}
handle.b.x.$on('change',q)
handle.b.x = 'axe'
-> All is transient

// The removal
handle.b.x.$off('change',q)
handle.b.x = 'ecks'
-> /* Nothing outputs */
```
