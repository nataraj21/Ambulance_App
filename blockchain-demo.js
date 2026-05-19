// ============================================================================
// SIMPLIFIED BLOCKCHAIN DEMO (EASY TO EXPLAIN)
// ============================================================================

const crypto = require('crypto');

// 📦 CONCEPT 1: THE BLOCK (A Box of Data)
// Think of a Block as a glass box. Everyone can see what's inside, 
// and it has a unique "Digital Fingerprint" (a Hash) stamped on it.
class Block {
  constructor(index, data, previousHash = '') {
    this.index = index;               // Box number
    this.timestamp = new Date().toISOString(); // When it was locked
    this.data = data;                 // What's inside (e.g., Money transfers)
    
    // This is the fingerprint of the PREVIOUS box. It's the "chain" in blockchain!
    this.previousHash = previousHash; 
    
    // Create our unique fingerprint based on everything inside the box
    this.hash = this.calculateFingerprint();  
  }

  // 🔑 CONCEPT 2: THE FINGERPRINT (Hashing)
  // If we change EVEN ONE LETTER of the data, this fingerprint completely changes.
  calculateFingerprint() {
    const everythingInTheBox = this.index + this.timestamp + JSON.stringify(this.data) + this.previousHash;
    return crypto.createHash('sha256').update(everythingInTheBox).digest('hex');
  }
}

// ⛓️ CONCEPT 3: THE BLOCKCHAIN (Tying the boxes together)
class Blockchain {
  constructor() {
    // The chain starts with an empty "Genesis" box
    this.chain = [new Block(0, "Genesis Block (The First Box)", "0")];
  }

  // Get the last box on the chain so we can tie the new one to it
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  // Add a new box
  addBlock(newBlock) {
    // 1. Tie the new box to the old box's fingerprint
    newBlock.previousHash = this.getLatestBlock().hash;
    // 2. Lock the new box (calculate its fingerprint)
    newBlock.hash = newBlock.calculateFingerprint();
    // 3. Add it to the chain
    this.chain.push(newBlock);
  }

  // 🛡️ CONCEPT 4: SECURITY (Checking for tampering)
  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBox = this.chain[i];
      const previousBox = this.chain[i - 1];

      // Check 1: Did someone sneakily change the data in this box?
      if (currentBox.hash !== currentBox.calculateFingerprint()) {
        return false; // The fingerprints don't match!
      }

      // Check 2: Did someone break the chain?
      if (currentBox.previousHash !== previousBox.hash) {
        return false; // The tie to the previous box is broken!
      }
    }
    return true; // Chain is perfectly secure!
  }
}

// ============================================================================
// 🎬 LIVE DEMONSTRATION SCRIPT
// ============================================================================

console.log("\n🏦 1. CREATING OUR NEW BLOCKCHAIN...");
let myCoin = new Blockchain();

console.log("Adding Box 1: Alice sends Bob $100");
myCoin.addBlock(new Block(1, { sender: "Alice", receiver: "Bob", amount: 100 }));

console.log("Adding Box 2: Bob sends Charlie $50");
myCoin.addBlock(new Block(2, { sender: "Bob", receiver: "Charlie", amount: 50 }));

console.log("\n✅ 2. IS THE CHAIN SECURE AND VALID?");
console.log("Result: " + (myCoin.isChainValid() ? "YES! It is perfectly secure." : "NO! It's broken."));

console.log("\n😈 3. A HACKER ATTACKS!");
console.log("Hacker is secretly changing Alice's transaction from $100 to $9000...");
// The hacker changes the data inside the block...
myCoin.chain[1].data = { sender: "Alice", receiver: "Bob", amount: 9000 };

console.log("\n🚨 4. IS THE CHAIN STILL SECURE?");
console.log("Result: " + (myCoin.isChainValid() ? "YES! It is perfectly secure." : "NO! TAMPERING DETECTED!"));

console.log("\n📖 WHAT HAPPENED?");
console.log("Because the hacker changed the data, Box 1's fingerprint became invalid.");
console.log("This broke the link to Box 2. The whole system immediately noticed the fraud! The hacker fails.\n");

/*
To run this file:
node blockchain-demo.js
*/
