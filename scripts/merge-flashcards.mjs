// Offline helper for the approved PRIVATE-repository workflow. Never use real data in this public checkout.
import fs from 'node:fs';
import vm from 'node:vm';
const [existing,incoming,output]=process.argv.slice(2);
if(!existing || !incoming || !output) {
  console.error('Usage: node scripts/merge-flashcards.mjs EXISTING.json INCOMING.json NEW-OUTPUT.json');
  process.exit(1);
}
const sandbox={window:{},TextEncoder};
vm.runInNewContext(fs.readFileSync(new URL('../docs/flashcards.js',import.meta.url),'utf8'),sandbox);
const {validateBackup,mergeCollections}=sandbox.window.JapaneseFlashcards.testing;
function read(path) {
  if(fs.statSync(path).size>2000000)throw Error('Backup exceeds 2 MB');
  return validateBackup(fs.readFileSync(path,'utf8'));
}
const merged=mergeCollections(read(existing),read(incoming));
const text=JSON.stringify({format:'japanese-reader-flashcards',version:1,exportedAt:new Date().toISOString(),...merged},null,2);
validateBackup(text);
// Exclusive create: do not overwrite either source or an existing result.
fs.writeFileSync(output,text+'\n',{flag:'wx',mode:0o600});
console.log('Merged backup written. Sources unchanged. Review privately before approving a GitHub write.');
