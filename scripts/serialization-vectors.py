#!/usr/bin/env python3
"""Regenerate app/__tests__/fixtures/coreOperationVectors.json.

Each entry is an operation (JSON) and the bytes bitshares-core itself makes of it: a node's
`database_api.get_transaction_hex` serializes the transaction with the chain's own code.
The Jest test `fixedOperations-test.ts` serializes the same JSON with bitsharesjs (plus
`lib/chain/fixedOperations.ts`) and compares. Run it again when an operation changes or a
new one is added:

    python3 scripts/serialization-vectors.py [https://node.example/ws]

It needs a node that knows the operations in question (operations 75-77 and the
custom authorities need a recent bitshares-core).
"""
import json
import os
import sys
import urllib.request

NODE = sys.argv[1] if len(sys.argv) > 1 else "https://node.xbts.io/ws"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "__tests__", "fixtures", "coreOperationVectors.json")


def call(api, method, params):
    request = urllib.request.Request(
        NODE,
        json.dumps({"jsonrpc": "2.0", "id": 1, "method": "call", "params": [api, method, params]}).encode(),
        {"content-type": "application/json", "user-agent": "curl/8 serialization-vectors"},
    )
    return json.load(urllib.request.urlopen(request, timeout=60))


def hex_of(op):
    """The bytes core makes of a transaction holding this one operation, without the transaction around it."""
    tx = {"ref_block_num": 1, "ref_block_prefix": 2, "expiration": "2030-01-01T00:00:00", "operations": [op], "extensions": [], "signatures": []}
    reply = call("database", "get_transaction_hex", [tx])
    if "error" in reply:
        return None, reply["error"]["message"][:200]
    # header (ref block 2 + prefix 4 + expiration 4) and the operation count (1) in front, extensions (1) and signatures (1) behind
    return reply["result"][2 * 11:-4], None

fee = {"amount":0,"asset_id":"1.3.0"}
acct = call("database","get_accounts",[["1.2.550836"]])["result"][0]
PK = acct["active"]["key_auths"][0][0]
PK2 = acct["owner"]["key_auths"][0][0] if acct["owner"]["key_auths"] else PK
gp = call("database","get_global_properties",[])["result"]["parameters"]
auth = {"weight_threshold":1,"account_auths":[["1.2.6",1]],"key_auths":[[PK,1]],"address_auths":[]}
H32 = "11"*32
H33 = "02"+"22"*32
samples = {
 "account_transfer": [9,{"fee":fee,"account_id":"1.2.5","new_owner":"1.2.6","extensions":[]}],
 "committee_member_update url": [30,{"fee":fee,"committee_member":"1.5.3","committee_member_account":"1.2.5","new_url":"https://example.org/committee"}],
 "committee_member_update no url": [30,{"fee":fee,"committee_member":"1.5.3","committee_member_account":"1.2.5"}],
 "custom": [35,{"fee":fee,"payer":"1.2.5","required_auths":["1.2.6","1.2.7"],"id":7,"data":"deadbeef00ff"}],
 "custom empty": [35,{"fee":fee,"payer":"1.2.5","required_auths":[],"id":0,"data":""}],
 "assert name": [36,{"fee":fee,"fee_paying_account":"1.2.5","predicates":[[0,{"account_id":"1.2.5","name":"committee-account"}]],"required_auths":["1.2.5"],"extensions":[]}],
 "assert all": [36,{"fee":fee,"fee_paying_account":"1.2.5","predicates":[[0,{"account_id":"1.2.5","name":"abc"}],[1,{"asset_id":"1.3.0","symbol":"BTS"}],[2,{"id":"ab"*20}]],"required_auths":[],"extensions":[]}],
 "override_transfer": [38,{"fee":fee,"issuer":"1.2.5","from":"1.2.6","to":"1.2.7","amount":{"amount":1000,"asset_id":"1.3.121"},"extensions":[]}],
 "transfer_to_blind": [39,{"fee":fee,"amount":{"amount":1000,"asset_id":"1.3.0"},"from":"1.2.5","blinding_factor":H32,"outputs":[{"commitment":H33,"range_proof":"abcdef","owner":auth},{"commitment":H33,"range_proof":"","owner":auth,"stealth_memo":{"one_time_key":PK,"to":PK2,"encrypted_memo":"0102"}}]}],
 "blind_transfer": [40,{"fee":fee,"inputs":[{"commitment":H33,"owner":auth}],"outputs":[{"commitment":H33,"range_proof":"aa","owner":auth,"stealth_memo":{"one_time_key":PK,"encrypted_memo":"01"}}]}],
 "transfer_from_blind": [41,{"fee":fee,"amount":{"amount":5,"asset_id":"1.3.0"},"to":"1.2.5","blinding_factor":H32,"inputs":[{"commitment":H33,"owner":auth}]}],
 "custom_authority_create": [54,{"fee":fee,"account":"1.2.5","enabled":True,"valid_from":"2030-01-01T00:00:00","valid_to":"2031-01-01T00:00:00","operation_type":0,"auth":auth,"restrictions":[
     {"member_index":2,"restriction_type":0,"argument":[7,"1.2.6"],"extensions":[]},
     {"member_index":3,"restriction_type":10,"argument":[39,[{"member_index":1,"restriction_type":6,"argument":[27,["1.3.0","1.3.121"]],"extensions":[]}]],"extensions":[]},
     {"member_index":0,"restriction_type":11,"argument":[40,[[{"member_index":2,"restriction_type":0,"argument":[7,"1.2.7"],"extensions":[]}],[{"member_index":2,"restriction_type":1,"argument":[7,"1.2.7"],"extensions":[]}]]],"extensions":[]},
     {"member_index":4,"restriction_type":2,"argument":[2,-5],"extensions":[]},
     {"member_index":4,"restriction_type":0,"argument":[3,"memo text"],"extensions":[]},
     {"member_index":4,"restriction_type":0,"argument":[4,"2030-02-02T00:00:00"],"extensions":[]},
     {"member_index":4,"restriction_type":0,"argument":[5,PK],"extensions":[]},
     {"member_index":4,"restriction_type":0,"argument":[1,True],"extensions":[]},
     {"member_index":4,"restriction_type":0,"argument":[6,H32],"extensions":[]},
     {"member_index":4,"restriction_type":0,"argument":[0,{}],"extensions":[]},
   ],"extensions":[]}],
 "custom_authority_create variant_assert": [54,{"fee":fee,"account":"1.2.5","enabled":False,"valid_from":"2030-01-01T00:00:00","valid_to":"2031-01-01T00:00:00","operation_type":1,"auth":auth,"restrictions":[
     {"member_index":4,"restriction_type":12,"argument":[41,[1,[{"member_index":0,"restriction_type":0,"argument":[2,3],"extensions":[]}]]],"extensions":[]}],"extensions":[]}],
 "custom_authority_update": [55,{"fee":fee,"account":"1.2.5","authority_to_update":"1.17.3","new_enabled":False,"new_valid_from":"2030-01-01T00:00:00","new_valid_to":"2031-01-01T00:00:00","new_auth":auth,"restrictions_to_remove":[1,2],"restrictions_to_add":[{"member_index":2,"restriction_type":0,"argument":[7,"1.2.6"],"extensions":[]}],"extensions":[]}],
 "custom_authority_update minimal": [55,{"fee":fee,"account":"1.2.5","authority_to_update":"1.17.3","restrictions_to_remove":[],"restrictions_to_add":[],"extensions":[]}],
 "custom_authority_delete": [56,{"fee":fee,"account":"1.2.5","authority_to_delete":"1.17.3","extensions":[]}],
 "samet_fund_borrow": [67,{"fee":fee,"borrower":"1.2.5","fund_id":"1.20.2","borrow_amount":{"amount":1000,"asset_id":"1.3.0"},"extensions":[]}],
 "samet_fund_repay": [68,{"fee":fee,"account":"1.2.5","fund_id":"1.20.2","repay_amount":{"amount":1000,"asset_id":"1.3.0"},"fund_fee":{"amount":2,"asset_id":"1.3.0"},"extensions":[]}],
 "committee_member_update_global_parameters": [31,{"fee":fee,"new_parameters":gp}],
}

out = {}
for name, op in samples.items():
    hexstring, error = hex_of(op)
    if error:
        sys.exit(f"{name}: the node refused it: {error}")
    out[name] = {"op": op, "hex": hexstring}
    print(f"{name:45} {len(hexstring)} hex characters")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as handle:
    json.dump(out, handle, indent=1)
    handle.write("\n")
print("wrote", OUT)
