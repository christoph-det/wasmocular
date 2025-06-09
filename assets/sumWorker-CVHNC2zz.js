(function(){"use strict";self.onmessage=function(t){const{a:s,b:e}=t.data;self.postMessage(n(s,e))};function n(t,s){if(s===0)return 0;let e=0;for(let u=0;u<s;u++)e+=t+n(t,s-1);return e}})();
