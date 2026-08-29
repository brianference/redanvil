import { hashPassword, verifyPassword, needsRehash, PBKDF2_ITERATIONS } from '../functions/_lib/password.ts'

let pass = 0, fail = 0
const check = (n: string, c: boolean, d = '') => { c ? (pass++, console.log('  PASS ' + n)) : (fail++, console.log('  FAIL ' + n + ' ' + d)) }

const rec = await hashPassword('correct-horse-battery-staple')
check('iterations are the Workers ceiling', rec.iterations === PBKDF2_ITERATIONS && rec.iterations === 100000, String(rec.iterations))
check('hash is base64 and non-empty', rec.hash.length > 20)
check('salt is base64 and non-empty', rec.salt.length > 10)

check('correct password verifies', await verifyPassword('correct-horse-battery-staple', rec))
check('wrong password rejected', !(await verifyPassword('wrong-horse-battery-staple', rec)))
check('empty password rejected', !(await verifyPassword('', rec)))
check('near-miss (one char) rejected', !(await verifyPassword('correct-horse-battery-stapl', rec)))
check('null record rejected', !(await verifyPassword('anything', null)))
check('partial record rejected', !(await verifyPassword('anything', { hash: rec.hash })))

const rec2 = await hashPassword('correct-horse-battery-staple')
check('same password yields a different salt', rec.salt !== rec2.salt)
check('same password yields a different hash', rec.hash !== rec2.hash)
check('both still verify', (await verifyPassword('correct-horse-battery-staple', rec2)) === true)

check('needsRehash false at current iterations', !needsRehash(rec))
check('needsRehash true at lower iterations', needsRehash({ ...rec, iterations: 50000 }))

console.log(`\nPASS ${pass}  FAIL ${fail}`)
console.log(fail === 0 ? 'PWTEST=GREEN' : 'PWTEST=RED')
process.exit(fail === 0 ? 0 : 1)
