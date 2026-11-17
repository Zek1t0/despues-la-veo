// Read committed runtime sources without checkout, staging or modifying historical tests.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),read=fs.readFileSync;
const [reference,test]=process.argv.slice(2);
if(!/^[a-f0-9]{40}$/.test(reference??'')||!test?.startsWith('docs/testing/')||test.includes('..'))throw Error('Invalid fixed baseline probe input');
fs.readFileSync=function(file,options){
 const rel=typeof file==='string'?path.relative(root,path.resolve(file)).replaceAll('\\','/'):'';
 if((rel.startsWith('src/')||rel.startsWith('app/'))&&/\.tsx?$/.test(rel)){
  const value=execFileSync('git',['show',reference+':'+rel],{cwd:root});
  const encoding=typeof options==='string'?options:options?.encoding;
  return encoding?value.toString(encoding):value;
 }
 return read.call(this,file,options);
};
require(path.join(root,test));
