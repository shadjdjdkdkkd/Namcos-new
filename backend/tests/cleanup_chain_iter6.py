import asyncio, os
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from dotenv import load_dotenv
load_dotenv('/app/backend/.env')
db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]

async def main():
    ids = []
    for p in ["+911234567890", "+919876543211"]:
        u = await db.users.find_one({"phone": p})
        if u:
            ids.append(str(u["_id"]))
    pays = await db.payments.find({"customer_id": {"$in": ids}}).to_list(100)
    txns = [p["transaction_id"] for p in pays]
    print("users", ids, "txns", txns)
    top = await db.users.find_one({"phone": "+919999999999"})
    tid = str(top["_id"])
    chain_top = await db.wallet_transactions.find({"user_id": tid, "reference_id": {"$in": txns}}).to_list(100)
    dec = sum(t["amount"] for t in chain_top if t["type"] == "credit")
    await db.wallet.update_one({"user_id": tid}, {"$inc": {"balance": -dec, "total_chain_earnings": -dec}})
    print("top reverted", dec)
    for col, q in [("wallet_transactions", {"$or": [{"reference_id": {"$in": txns}}, {"user_id": {"$in": ids}}]}),
                   ("referral_earnings", {"reference_id": {"$in": txns}}),
                   ("transactions", {"reference_id": {"$in": txns}}),
                   ("payments", {"transaction_id": {"$in": txns}}),
                   ("settlements", {"transaction_id": {"$in": txns}}),
                   ("orders", {"customer_id": {"$in": ids}}),
                   ("notifications", {"$or": [{"user_id": {"$in": ids}}, {"user_id": tid, "message": {"$regex": "TEST_"}}]}),
                   ("wallet", {"user_id": {"$in": ids}}),
                   ("users", {"_id": {"$in": [ObjectId(i) for i in ids]}})]:
        r = await db[col].delete_many(q)
        print(col, r.deleted_count)
    print("wallet top", (await db.wallet.find_one({"user_id": tid}, {"_id": 0, "balance": 1})))
    s = await db.stores.find_one({"_id": ObjectId("6ace61433fe289ae57ef1aa9")}, {"chain_percent": 1, "chain_tiers": 1})
    print("store", s)
    print("chain", await db.settings.find_one({"key": "chain"}, {"_id": 0}))
    print("branding", await db.settings.find_one({"key": "branding"}, {"_id": 0}))

asyncio.run(main())
