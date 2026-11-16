// Reproduce the old timestamp fixture against committed HEAD sources, without a checkout.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const read=fs.readFileSync,root=path.resolve(__dirname,'../../..');
fs.readFileSync=function(file,options){
 const rel=typeof file==='string'?path.relative(root,path.resolve(file)).replaceAll('\\','/'):'';
 if(rel.startsWith('src/')&&/\.tsx?$/.test(rel)){
  const value=execFileSync('git',['show','HEAD:'+rel],{cwd:root});
  return typeof options==='string'?value.toString(options):options?.encoding?value.toString(options.encoding):value;
 }
 return read.call(this,file,options);
};
require('./section-2-storage.cjs');
