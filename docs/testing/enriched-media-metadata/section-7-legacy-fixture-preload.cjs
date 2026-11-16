// Explicit adapter for old UI fixtures without a preference repository.
// Original suites are also executed unchanged; this does not validate hydration.
const Module=require('node:module'),load=Module._load;
Module._load=function(request,parent,isMain){
 if(request.endsWith('/useMediaLanguages'))return {useMediaLanguages:()=>({languages:['es','en','ja-Latn'],preference:{value:{hideSensitive:false},updatedAt:0},ready:true,error:null,retry(){}})};
 return load.call(this,request,parent,isMain);
};
