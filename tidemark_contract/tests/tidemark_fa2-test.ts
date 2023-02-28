

import * as att from "@completium/archetype-ts-types";
import { ArchetypeType, Rational, Duration, date_cmp, Tez, Bytes, Address, Nat, Enum, CallResult } from '@completium/archetype-ts-types';
import { tidemark_fa2} from './binding/tidemark_fa2'
import {get_account, set_mockup, set_mockup_now, set_quiet, Account, Parameters, delay_mockup_now_by_minute, delay_mockup_now_by_week, delay_mockup_now_by_second} from "@completium/experiment-ts";
import { expect_to_fail } from '@completium/experiment-ts';
import { BigNumber } from 'bignumber.js'
const assert = require('assert')
const readline = require('readline');
/* Accounts ---------------------------------------------------------------- */

const creator_one = get_account('creator_one')
const owner_one = get_account('owner_one')
const owner_two = get_account('owner_two')
const owner_three = get_account('owner_three')
const owner_four = get_account('owner_four')
const owner_five = get_account('owner_five')
const owner_six = get_account('owner_six')
const collector_one = get_account('collector_one')
const collector_two = get_account('collector_two')
const collector_three = get_account('collector_three')
const marketplace_one = get_account('marketplace_one')
const marketplace_two = get_account('marketplace_two')
const marketplace_three = get_account('marketplace_three')
const minter_one = get_account('minter_one')
const minter_two = get_account('minter_two')
const minter_three = get_account('minter_three')

const creator_one_address = creator_one.get_address()
const owner_one_address = owner_one.get_address()
const owner_two_address = owner_two.get_address()
const owner_three_address = owner_three.get_address()
const owner_four_address = owner_four.get_address()
const owner_five_address = owner_five.get_address()
const owner_six_address = owner_six.get_address()
const collector_one_address = collector_one.get_address()
const collector_two_address = collector_two.get_address()
const collector_three_address = collector_three.get_address()
const marketplace_one_address = marketplace_one.get_address()
const marketplace_two_address = marketplace_two.get_address()
const marketplace_three_address = marketplace_three.get_address()
const minter_one_address = minter_one.get_address()
const minter_two_address = minter_two.get_address()
const minter_three_address = minter_three.get_address()

/* Verbose mode ------------------------------------------------------------ */

set_quiet(true);

/* Endpoint ---------------------------------------------------------------- */

set_mockup()
//TODO create init_mockup function for ts-types library

/* Logging utils ------------------------------------------------------------- */

const objectMap = (obj: any, fn: any) =>
Object.fromEntries(
  Object.entries(obj).map(
    ([k, v], i) => [k, fn(v, k, i)]
  )
)

const make_readable = (x : any) : string => {
if (typeof x == "string") return x
if (typeof x == "number") return x.toString()
if (typeof x == "boolean") return x.toString()
if (x instanceof BigNumber) return x.toString()
if (x instanceof Date) return x.toString()
if (x instanceof Address) return x.toString()
if (x instanceof Bytes) return x.toString()
if (x instanceof Enum) return x.toString()
if (x instanceof Nat) return x.toString()
if (x instanceof Rational) return x.toString()
if (x instanceof Duration) return x.toString() + "seconds"
if (x instanceof Tez) return x.toString("tez") + " tez"
return x
}

const make_object_readable = (x : any) : any => {
  const readable_object = objectMap(x, make_readable)
  return readable_object
}
// const make_asset_readable = (x : any) : string => {
// }

/* Tez Date Utils ---------------------------------------------------------- */

export class TezDate implements ArchetypeType {
  private _content: Date
  constructor(v: Date = new Date()) {
    this._content = new Date(v.getTime() - v.getMilliseconds())
  }
  equals(x: TezDate): boolean {
    return this.toSecond() === x.toSecond()
  }
  toSecond(): number {
    return this._content.getTime() / 1000
  }
  addDuration(dur: Duration): TezDate {
    return new TezDate(
      new Date(this.toSecond()*1000 + dur.toSecond()*1000) 
  )}
  addDurationLiteral(x : string) : TezDate {
    return this.addDuration(new Duration(x))
  }
  toDate(): Date { 
    return new Date(this._content)
  }
}





/* Utils ------------------------------------------------------------------- */

  interface costObject {
    call_name: string,
    apparent_cost: BigNumber,
  }

  interface testParams {
    name: string,
    description: string,
    account : Account,
    expected_change: number,
    ec_BN: BigNumber, // expected_change as BigNumber
    expected_direction: "increase" | "decrease" | "unchanged",
    expected_amount: string,
    actual_before: BigNumber,
    actual_after: BigNumber,
    expected_after: BigNumber,
    error_message: string
    info_message: string,
    accumulated_cost: BigNumber,
    cost_array: costObject[],

    // variable_function: 
    // variable_before: any,
    // variable_after: any,

  }

  interface CallMaker {
    name: string,
    description: string,
    as: Account,
    amount: Tez,
    call: (call_params: Parameters) => Promise<any>
    delay_after: number
  }

function posify (num : BigNumber) : BigNumber {
  if (num.isNegative()) return num.negated()
  return num
}

function negify (num : BigNumber) : BigNumber {
  if (num.isPositive()) return num.negated()
  return num
}
// with_cost function provides the cost of a transaction
const make_call_get_delta = async (f : { (call_params : Parameters) : Promise<any> }, call_params: Parameters) : Promise<BigNumber> => {
  const balance_before = await call_params.as.get_balance();
  const res = await f(call_params);
  const balance_after = await call_params.as.get_balance();
  return balance_before.to_big_number().minus(balance_after.to_big_number());
}

 async function run_scenario_test(
  scenario_description: string,
  call_makers : CallMaker[],
  tpArray: Array<testParams>
  ) : Promise<testParams[]> {
    
    for (const tp of tpArray) {
      tp.ec_BN = new BigNumber(tp.expected_change).times(1000000)
      tp.actual_before = (await tp.account.get_balance()).to_big_number()
      tp.expected_direction = tp.ec_BN.isZero() ? "unchanged" : 
      tp.ec_BN.isPositive() ? "increase" : "decrease"
      tp.expected_amount = new Tez(posify(tp.ec_BN), 'mutez').toString('tez')
      tp.accumulated_cost = new BigNumber(0)
      tp.cost_array = []
    }

 for (const cm of call_makers){
  if (!cm.amount) throw "amount must be explicitly specified for account: " + cm.as.get_name()
  if (!cm.as) throw "account must be explicitly specified for m cms"
  
  let balance_delta = await make_call_get_delta(cm.call, {as: cm.as, amount: cm.amount})
  const apparent_cost = balance_delta.minus(cm.amount.to_big_number())
  const target_tp_index = tpArray.findIndex(tp => tp.account === cm.as)
  const cost_accumulator = tpArray[target_tp_index].accumulated_cost.plus(apparent_cost)
  tpArray[target_tp_index].accumulated_cost = cost_accumulator
  tpArray[target_tp_index].cost_array.push({call_name: cm.name, apparent_cost: apparent_cost})

  delay_mockup_now_by_second(cm.delay_after)
   }
for (const tp of tpArray) {
  
  const actual_before = tp.actual_before
  const actual_after = await (await tp.account.get_balance()).to_big_number()
  const expected_after = actual_before.plus(tp.ec_BN).minus(tp.accumulated_cost)
  const actual_change = actual_after.minus(actual_before)
  const actual_direction = actual_change.isZero() ? "unchanged" : 
        actual_change.isPositive() ? "increase" : "decrease"
  const actual_amount = tezBNtoString(posify(actual_change))

  const testError : string = 
  `ERROR: ${tp.account.get_name()} :
   expected_after: ${expected_after}
   actual_after: ${actual_after}
   expected: ${tp.expected_direction} by ${tp.expected_amount}
   actual: ${actual_direction} by ${actual_amount}
   `
  tp.error_message = testError

    tp.actual_after = actual_after
    tp.expected_after = expected_after


  //TODO FIX THIS UP:::
    const successMessage = `\t${tp.account.get_name()} : ${actual_direction} by ${actual_amount}`
    tp.info_message = successMessage
    if (tp.cost_array.length > 0) {
      tp.cost_array.forEach(costObject => {
        tp.info_message += `\n\tCost to call '${costObject.call_name}' : ${tezBNtoString(costObject.apparent_cost)}`
      })
      tp.info_message += `\n\tTotal_costs: ${tezBNtoString(tp.accumulated_cost)}`
      
    }

  }
  return tpArray
  }


/* Now --------------------------------------------------------------------- */

// const nativeDateNow = new Date()
// const tezDateNow = new TezDate(nativeDateNow)
// const tezDate5 = tezDateNow.addDurationLiteral('5m')
// const tezDate10 = tezDateNow.addDurationLiteral('10m')

// /* Scenario ---------------------------------------------------------------- */


const creatorRate = new Rational(1/10)
const minterRate = new Rational(1/100)
const marketplaceRate = new Rational(1/100)

const creatorRateBN = new Rational(1/10).to_big_number()
const minterRateBN = new Rational(1/100).to_big_number()
const marketplaceRateBN = new Rational(1/100).to_big_number()

describe('[Tidemark_fa2] contract', async () => {
  it('Deploys successfully', async () => {

    await tidemark_fa2.deploy(
      creator_one_address,
      creator_one_address,
      minter_one_address,
      {}) // params
  });

})

const tmdBytes = Bytes.hex_encode("ipfs://bafybeigzpfsrvvb3ifrfe4tmahmenuf3flbyhi5y4v6g4fn6pqpiqd4wwy")
let tmdMap : Array<[string, Bytes]> = [[" ", tmdBytes]]

describe('[Mint] entrypoint', async () => {
  it('Does not fail with correct inputs', async () => {

    await tidemark_fa2.mint(
      tmdMap,
      creatorRate,
      minterRate,
      marketplaceRate,
      {as: creator_one}) // params

    }); 

  // it('Second nft mints succesfully', async () => {

  //   await tidemark_fa2.mint(
  //     tmdMap,
  //     creatorRate,
  //     minterRate,
  //     marketplaceRate,

  //     {as: creator_one}) // params
    
  //     const ledger_value_two = await tidemark_fa2.get_ledger_value(new Nat(2))
  //     logContainer("ledger_value_two", ledger_value_two)
      
  //     const metadata_value_two = await tidemark_fa2.get_token_metadata_value(new Nat(2))
  //     logContainer("token_info_2", metadata_value_two?.token_info)

  // });

})
 
//CONSTANTS

describe('[Make Offer] 2 successful calls', async () => {

  before(async function() {
    //NOTE that this before block is actually being run AFTER tpDataArray and then the it blocks are defined,
    //but BEFORE the actual content of the it blocks are run.
    
    //ENTRYPOINT CALLS AND THEIR CALL PARAMETERS
    
    testDataArray = await run_scenario_test(
      //Scenario Description:
      "Collector one makes an offer for token 1 for 10 tez via marketplace_one",
      //Array of calls to make:
      [{
        name: "C2 bid 5",
        // description: "Collector two makes an offer for 5 tez on token one via marketplace_one",
        as: collector_two, 
        amount: new Tez(5), 
        call: (cp) => tidemark_fa2.make_offer(new Nat(1), marketplace_one_address, cp),
        delay_after: 100
      } as CallMaker, 
      { 
        name: "C1 bid 10",
        // description: "Collector one makes an offer for 10 tez on token one via marketplace_one",
        as: collector_one,
        amount: new Tez(10), 
        call: (cp) => tidemark_fa2.make_offer(new Nat(1), marketplace_one_address, cp),
        delay_after: 150
      } as CallMaker,
    ],
    //Don't plug the test data array into the testDataArray parameter directly 
    //- it has to be in the top level of the describe block, or mocha won't be able to handle it
    testDataArray
  )
  })

  //LIST OF ACCOUNTS TO TEST AND EXPECTED CHANGES

  let testDataArray : Array<testParams> = [{
    description: "creator_one recieves 1/10 of bid as creator_fee",
    account: creator_one,
    expected_change: 1,
  } as testParams,
  {
    description: "minter_one recieves 1/100 of bid as minter_fee",
    account: minter_one,
    expected_change: 0.1
  } as testParams,
  {
    description: "marketplace_one recieves no fee",
    account: marketplace_one,
    expected_change: 0,
  } as testParams,
  {
    description: "collector_one pays bid",
    account: collector_one,
    expected_change: -10,
  } as testParams,
  {
    description: "collector_two bids unsuccessfully",
    account: collector_two,
    expected_change: 0,
  } as testParams
  ]

  //EXECUTE TESTS FROM ARRAY.
  //This cannot be refactored into a function because mocha only looks for 
  //'it' tests in describe blocks, not in lower scope functions.
  for (const tp of testDataArray) {
  it(`${tp.description}`, async function() {
    this.tp = tp
          assert(tp.actual_after.isEqualTo(tp.expected_after), tp.error_message) 
      })
    }

  afterEach(async function() {
    if (this.tp && this.tp.info_message) {
      console.log(this.tp.info_message)
    }
  })
})

// describe('[Sell] Make one sell call', async () => {
//   //ENTRYPOINT CALLS AND THEIR CALL PARAMETERS
//   let description : string = "Single sale"
  
//   const call_params_one : Parameters = {
//     as: collector_one,
//     amount: new Tez(0)
//   }
//   const sell = (call_params : Parameters) => tidemark_fa2...

  // const call_params_two : Parameters = {
  //   as: collector_two,
  //   amount: new Tez(0)
  // }
  // const make_offer_two = (call_params: Parameters) => tidemark_fa2...

  //LIST OF ACCOUNTS TO TEST AND EXPECTED CHANGES
  // let tpDataArray : Array<testParams> = [{
  //   description: "template",
  //   account: account_one,
  //   expected_change: 1,
  // } as testParams,
  // {
  //   description: "tmeplate",
  //   account: account_two,
  //   expected_change: 2
  // } as testParams,
  // ]

  // before(async function() {
    //NOTE that this before block is actually being run AFTER tpDataArray and then the it blocks are defined,
    //but BEFORE the actual content of the it blocks are run. That's why it is placed here in the doc
  // tpDataArray = await run_scenario_test(
  //   description,
  //   tpDataArray,
  //   100,
  //   [
  //     {cp: call_params_one, fn: make_offer_one}, 
  //     {cp: call_params_two, fn: make_offer_two}
  //   ]
  // )
  // })

//   for (const tp of tpDataArray) {
//   it(`${tp.description}`, async function() {
//     this.tp = tp
//           assert(tp.actual_after.isEqualTo(tp.expected_after), tp.error_message) 
//       })
//     }

//   afterEach(async function() {
//     if (this.tp && this.tp.info_message) {
//       console.log(this.tp.info_message)
//     }
//   })
// })




// describe('[sell] entrypoint', async () => {
//   it('Does not fail with correct inputs', async () => {

//     await tidemark_fa2.sell(new Nat(1), {as: creator_one})
//     const ledger_value_one = await tidemark_fa2.get_ledger_value(new Nat(1))
//    delay_mockup_now_by_minute(500)

//   })

// // OWNER IS NOW COLLECTOR_ONE
//   it('Can be bought and sold a few times without error', async () => {
//     console.log("before bid of 5")
//     await tidemark_fa2.make_offer(new Nat(1), marketplace_two_address, new Tez(5), {as: collector_three, amount: new Tez(5)})
//     console.log("before bid of 30")
//     await tidemark_fa2.make_offer(new Nat(1), marketplace_two_address, new Tez(30), {as: collector_two, amount: new Tez(30)})
//     console.log("before sale at 30")
//     await tidemark_fa2.sell(new Nat(1), {as: collector_one})
//     delay_mockup_now_by_minute(200)
//     console.log("owner is now collector_one")

// //OWNER IS NOW COLLECTOR_TWO
//     console.log("before bid of 80")
//     await tidemark_fa2.make_offer(new Nat(1), marketplace_three_address, new Tez(80), {as: collector_one, amount: new Tez(80)})
//     console.log("before bid of 120")
//     await tidemark_fa2.make_offer(new Nat(1), marketplace_two_address, new Tez(120), {as: collector_three, amount: new Tez(120)})
//     console.log("before sale at 120")
//     await tidemark_fa2.sell(new Nat(1), {as: collector_two})
//     delay_mockup_now_by_minute(5000)
//     console.log("owner is now collector_two")

// //OWNER IS NOW COLLECTOR_THREE
//     await tidemark_fa2.make_offer(new Nat(1), marketplace_one_address, new Tez(180), {as: collector_one, amount: new Tez(180)})
//     await tidemark_fa2.make_offer(new Nat(1), marketplace_two_address, new Tez(230), {as: owner_one, amount: new Tez(230)})
//     await tidemark_fa2.sell(new Nat(1), {as: collector_three})
//     delay_mockup_now_by_minute(50)
//     console.log("owner is now collector_three")


// //OWNER IS NOW OWNER_ONE
//     await tidemark_fa2.make_offer(new Nat(1), marketplace_one_address, new Tez(40), {as: collector_one, amount: new Tez(40)})
//     await tidemark_fa2.make_offer(new Nat(1), marketplace_two_address, new Tez(500), {as: owner_two, amount: new Tez(500)})
//     await tidemark_fa2.sell(new Nat(1), {as: owner_one})
//     delay_mockup_now_by_minute(50)
//     console.log("owner is now owner_one")
// //OWNER IS NOW OWNER_TWO

// })
// })

function tezMinus(bigSum : Tez, smallSum : Tez) {
  const output = bigSum.to_big_number().minus(smallSum.to_big_number())
  if (output.isNegative()) throw Error (`tezMinus output of ${output} is invalid.`)

  return new Tez(output)
}

function tezAsNumber (input : Tez) {
  return input.to_big_number().dividedBy(1000000).toNumber()
}

function tezAsString ( input : Tez) {
  return `${tezAsNumber(input)} tez`
}

function tezBNtoString (input : BigNumber) {
  if (input === new BigNumber(0)) return `0 tez`
  if (!input) throw Error (`tezBigNumberToString input of ${input} is invalid.`)
  return `${input.dividedBy(1000000).toNumber()} tez`
}

// function logTezChange (contractName: string, before: Tez, after: Tez) {
//   let tezChange = tezAsNumber(after) - tezAsNumber(before)
//   let sign = ``
//   let stringColour
//   switch (true) {
//     case (tezChange > 0):
//       stringColour = `\x1b[32m`;
//       sign = `+`
//       break
//     case (tezChange < 0):
//       stringColour = `\x1b[31m`
//       break
//     default:
//       stringColour = ``
//       break
//   }
//   console.log(`Change in ${contractName}:`, stringColour, `${sign} ${tezAsNumber(after) - tezAsNumber(before)}`, `\x1b[0m`, `tez`)
// }





//completium-cli set binary path archetype


  // Argument of type '[{ cp: Parameters; fn: (call_params: Parameters) => Promise<CallResult>; }, { cp: Parameters; fn: (call_params: Parameters) => Promise<...>; }]'
  //  is not assignable to parameter of type 
  //  '[{ cp: Parameters; fn: (call_params: Parameters) => Promise<CallResult>; }]'.
  // Source has 2 element(s) but target allows only 1.

  // it('variable test - tidemark  ', async () => {
  
  //   const ledger_1 = await tidemark_fa2.get_ledger_value(new Nat(1))
  //   console.log(make_object_readable(ledger_1))
  //   const tidemark_before = ledger_1?.l_tidemark
  //   assert(tidemark_before?.equals(new Tez(10)), "tidemark should be 10 tez")
  // })


  // it('Second lower offer fails', async () => {
  // expect_to_fail(async () => {
  // await tidemark_fa2.make_offer(new Nat(1), marketplace_one_address, new Tez(3), {as: collector_two, amount: new Tez(3)})
  // }, att.string_to_mich("incoming bid must be greater than current bid"))

  // })

  // it('Second higher offer succeeds  ', async () => {
  
  //   const ledger_1 = await tidemark_fa2.get_ledger_value(new Nat(1))
  //   const tidemark_before = ledger_1?.l_tidemark
  //   assert(tidemark_before?.equals(new Tez(10)), "tidemark should be 10 tez")
  //   await tidemark_fa2.make_offer(new Nat(1), marketplace_one_address, new Tez(20), {as: collector_one, amount: new Tez(20)}) // params
    
  //   const ledger_1_after = await tidemark_fa2.get_ledger_value(new Nat(1))
  //   const tidemark_after = ledger_1_after?.l_tidemark
  
  //   assert(tidemark_after?.equals(new Tez(20)), "tidemark should be 20 tez")
  //   delay_mockup_now_by_minute(400)
  
  //   })








  ///// TEMPLATE TEMPLATE TEMPLATE //////

  // describe('[TEMPLATE] template', async () => {
  //ENTRYPOINT CALLS AND THEIR CALL PARAMETERS
  // let description : string = "Template"
  
  // const call_params_one : Parameters = {
  //   as: collector_one,
  //   amount: new Tez(0)
  // }
  // const make_offer_one = (call_params : Parameters) => tidemark_fa2...

  // const call_params_two : Parameters = {
  //   as: collector_two,
  //   amount: new Tez(0)
  // }
  // const make_offer_two = (call_params: Parameters) => tidemark_fa2...

  //LIST OF ACCOUNTS TO TEST AND EXPECTED CHANGES
  // let tpDataArray : Array<testParams> = [{
  //   description: "template",
  //   account: account_one,
  //   expected_change: 1,
  // } as testParams,
  // {
  //   description: "tmeplate",
  //   account: account_two,
  //   expected_change: 2
  // } as testParams,
  // ]

  // before(async function() {
    //NOTE that this before block is actually being run AFTER tpDataArray and then the it blocks are defined,
    //but BEFORE the actual content of the it blocks are run. That's why it is placed here in the doc
  // tpDataArray = await run_scenario_test(
  //   description,
  //   tpDataArray,
  //   100,
  //   [
  //     {cp: call_params_one, fn: make_offer_one}, 
  //     {cp: call_params_two, fn: make_offer_two}
  //   ]
  // )
  // })

//   for (const tp of tpDataArray) {
//   it(`${tp.description}`, async function() {
//     this.tp = tp
//           assert(tp.actual_after.isEqualTo(tp.expected_after), tp.error_message) 
//       })
//     }

//   afterEach(async function() {
//     if (this.tp && this.tp.info_message) {
//       console.log(this.tp.info_message)
//     }
//   })
// })