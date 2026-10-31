from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import os, logging
from pathlib import Path
from datetime import datetime, timezone, timedelta

from database import client, db
from auth_utils import hash_password
from routes.auth import auth_router
from routes.stores import stores_router
from routes.products import products_router
from routes.orders import orders_router
from routes.payments import payments_router
from routes.listings import listings_router
from routes.admin import admin_router
from routes.search import search_router
from routes.common import common_router
from routes.uploads import uploads_router
from routes.admin_ext import admin_ext_router
from routes.mylistings import mylistings_router
from routes.extra import extra_router
from routes.payout import payout_router
from routes.chain import chain_router
from storage import init_storage

ROOT_DIR = Path(__file__).parent
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NAMCOS API v1.0", description="NAMCOS Local Commerce Platform")

for router in [auth_router, stores_router, products_router, orders_router,
               payments_router, listings_router, admin_router, admin_ext_router,
               search_router, common_router, uploads_router, mylistings_router,
               extra_router, payout_router, chain_router]:
    app.include_router(router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def create_indexes():
    await db.users.create_index("phone", unique=True, sparse=True)
    await db.users.create_index("email", unique=True, sparse=True)
    await db.otps.create_index("expires_at", expireAfterSeconds=0)
    await db.payments.create_index("transaction_id", unique=True, sparse=True)
    await db.orders.create_index("order_number", unique=True, sparse=True)
    await db.payments.create_index("idempotency_key", sparse=True)
    logger.info("Database indexes created")

async def seed_data():
    admin_email = os.environ.get("ADMIN_EMAIL", "glowcelesta@gmail.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@namcos2024")

    existing_admin = await db.users.find_one({"email": admin_email})
    if not existing_admin:
        await db.users.insert_one({
            "email": admin_email, "name": "NAMCOS Admin",
            "password_hash": hash_password(admin_password),
            "roles": ["admin", "super_admin"], "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin seeded: {admin_email}")
    elif not existing_admin.get("password_hash"):
        await db.users.update_one({"email": admin_email},
                                   {"$set": {"password_hash": hash_password(admin_password)}})

    # Seed categories (drop and re-seed if old format without is_active/display_order)
    first_cat = await db.categories.find_one()
    if first_cat and ('is_active' not in first_cat or 'display_order' not in first_cat):
        await db.categories.drop()
        first_cat = None
    if not first_cat:
        categories = [
            {"name": "Shops", "slug": "shops", "icon": "Store", "color": "#0F4C3A", "is_active": True, "display_order": 1, "service_type": "store", "description": "Local retail stores & supermarkets", "support_phone": "", "max_distance_km": 20},
            {"name": "Services", "slug": "services", "icon": "Wrench", "color": "#2563EB", "is_active": True, "display_order": 2, "service_type": "service", "description": "Electricians, plumbers & more", "support_phone": "", "max_distance_km": 20},
            {"name": "Agriculture", "slug": "agriculture", "icon": "Leaf", "color": "#16A34A", "is_active": True, "display_order": 3, "service_type": "agriculture", "description": "Fresh produce & farm products", "support_phone": "", "max_distance_km": 20},
            {"name": "Classifieds", "slug": "classifieds", "icon": "Tag", "color": "#7C3AED", "is_active": True, "display_order": 4, "service_type": "classified", "description": "Buy & sell anything", "support_phone": "", "max_distance_km": 50},
            {"name": "Food", "slug": "food", "icon": "UtensilsCrossed", "color": "#EA580C", "is_active": True, "display_order": 5, "service_type": "store", "description": "Restaurants & food delivery", "support_phone": "", "max_distance_km": 10},
            {"name": "Health", "slug": "health", "icon": "Heart", "color": "#DB2777", "is_active": True, "display_order": 6, "service_type": "store", "description": "Healthcare & wellness", "support_phone": "", "max_distance_km": 15},
            {"name": "Home", "slug": "home", "icon": "HomeIcon", "color": "#0891B2", "is_active": True, "display_order": 7, "service_type": "store", "description": "Home & furniture", "support_phone": "", "max_distance_km": 20},
        ]
        await db.categories.insert_many(categories)
        logger.info("Categories seeded")

    # Seed demo stores
    if not await db.stores.find_one({"status": "published"}):
        demo_stores = [
            {"business_name": "Green Mart", "business_type": "Supermarket",
             "owner_name": "Rajesh Kumar", "phone": "+919876543210",
             "description": "Your neighborhood grocery store with fresh produce and daily essentials",
             "locality": "Kozhikode", "area": "Calicut Beach", "city": "Kozhikode",
             "state": "Kerala", "pincode": "673001", "latitude": 11.2588, "longitude": 75.7804,
             "address": "12/A, Beach Road, Calicut", "categories": ["grocery"],
             "opening_time": "08:00", "closing_time": "21:00",
             "operating_days": ["Mon","Tue","Wed","Thu","Fri","Sat"],
             "delivery_available": True, "pickup_available": True, "service_radius": 5.0,
             "status": "published", "verified": True, "rating": 4.5, "review_count": 24,
             "logo": None, "cover_image": None, "images": [], "owner_id": "demo",
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"business_name": "Spice Garden Restaurant", "business_type": "Restaurant",
             "owner_name": "Fatima Nasser", "phone": "+919845678901",
             "description": "Authentic Malabar cuisine with traditional recipes passed down generations",
             "locality": "Kozhikode", "area": "Mavoor Road", "city": "Kozhikode",
             "state": "Kerala", "pincode": "673004", "latitude": 11.2512, "longitude": 75.7763,
             "address": "45, Mavoor Road, Kozhikode", "categories": ["food"],
             "opening_time": "11:00", "closing_time": "22:00",
             "operating_days": ["Tue","Wed","Thu","Fri","Sat","Sun"],
             "delivery_available": True, "pickup_available": True, "service_radius": 3.0,
             "status": "published", "verified": True, "rating": 4.7, "review_count": 48,
             "logo": None, "cover_image": None, "images": [], "owner_id": "demo",
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"business_name": "TechHub Electronics", "business_type": "Electronics Store",
             "owner_name": "Arun Menon", "phone": "+919765432109",
             "description": "Mobile phones, laptops, accessories and repair services",
             "locality": "Thrissur", "area": "Round South", "city": "Thrissur",
             "state": "Kerala", "pincode": "680001", "latitude": 10.5276, "longitude": 76.2144,
             "address": "25, Round South, Thrissur", "categories": ["electronics"],
             "opening_time": "09:30", "closing_time": "20:30",
             "operating_days": ["Mon","Tue","Wed","Thu","Fri","Sat"],
             "delivery_available": False, "pickup_available": True, "service_radius": 0.0,
             "status": "published", "verified": True, "rating": 4.2, "review_count": 15,
             "logo": None, "cover_image": None, "images": [], "owner_id": "demo",
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"business_name": "Style Hub Fashion", "business_type": "Clothing Store",
             "owner_name": "Priya Sharma", "phone": "+919654321098",
             "description": "Latest trends in men's and women's fashion at affordable prices",
             "locality": "Ernakulam", "area": "MG Road", "city": "Kochi",
             "state": "Kerala", "pincode": "682011", "latitude": 9.9312, "longitude": 76.2673,
             "address": "56, MG Road, Kochi", "categories": ["fashion"],
             "opening_time": "10:00", "closing_time": "21:00",
             "operating_days": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
             "delivery_available": True, "pickup_available": True, "service_radius": 10.0,
             "status": "published", "verified": True, "rating": 4.3, "review_count": 31,
             "logo": None, "cover_image": None, "images": [], "owner_id": "demo",
             "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        result = await db.stores.insert_many(demo_stores)
        store_ids = [str(i) for i in result.inserted_ids]

        demo_products = [
            {"name": "Fresh Tomatoes", "store_id": store_ids[0], "merchant_id": "demo",
             "category": "Vegetables", "price": 40.0, "sale_price": 35.0, "unit": "kg",
             "stock": 50, "availability": "in_stock", "status": "active",
             "description": "Fresh farm tomatoes, picked daily", "images": [],
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Basmati Rice 5kg", "store_id": store_ids[0], "merchant_id": "demo",
             "category": "Grains", "price": 380.0, "sale_price": 350.0, "unit": "pack",
             "stock": 30, "availability": "in_stock", "status": "active",
             "description": "Premium aged basmati rice", "images": [],
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Coconut Oil 1L", "store_id": store_ids[0], "merchant_id": "demo",
             "category": "Grocery", "price": 220.0, "sale_price": None, "unit": "bottle",
             "stock": 20, "availability": "in_stock", "status": "active",
             "description": "Cold-pressed pure coconut oil", "images": [],
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Chicken Biryani", "store_id": store_ids[1], "merchant_id": "demo",
             "category": "Food", "price": 220.0, "sale_price": None, "unit": "plate",
             "stock": 999, "availability": "in_stock", "status": "active",
             "description": "Malabar-style dum biryani with authentic spices", "images": [],
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Parotta & Beef Curry", "store_id": store_ids[1], "merchant_id": "demo",
             "category": "Food", "price": 120.0, "sale_price": None, "unit": "set",
             "stock": 999, "availability": "in_stock", "status": "active",
             "description": "Flaky Kerala parotta with rich beef curry", "images": [],
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"name": "Samsung Galaxy A55", "store_id": store_ids[2], "merchant_id": "demo",
             "category": "Mobile Phones", "price": 34999.0, "sale_price": 32999.0, "unit": "piece",
             "stock": 5, "availability": "in_stock", "status": "active",
             "description": "Latest Samsung Galaxy A55 with 6.6\" display", "images": [],
             "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        await db.products.insert_many(demo_products)
        logger.info("Demo stores & products seeded")

    # Seed demo agriculture
    if not await db.agriculture.find_one({"status": "published"}):
        await db.agriculture.insert_many([
            {"seller_id": "demo", "product_name": "Organic Nendran Bananas", "category": "Vegetables & Fruits",
             "description": "Organically grown Nendran bananas from our family farm. No pesticides, handpicked fresh.",
             "unit": "bunch", "price": 60.0, "min_quantity": 1, "available_quantity": 200,
             "availability": "available", "is_organic": True, "pickup_available": True,
             "delivery_available": True, "bulk_available": True, "locality": "Kozhikode",
             "city": "Kozhikode", "state": "Kerala",
             "seller_name": "Rajan Nair", "seller_phone": "+919876521234",
             "rating": 4.4, "images": [],
             "status": "published", "created_at": datetime.now(timezone.utc).isoformat()},
            {"seller_id": "demo", "product_name": "Fresh Turmeric Roots", "category": "Spices",
             "description": "Fresh harvested turmeric roots, high curcumin content. Great for cooking and health.",
             "unit": "kg", "price": 80.0, "min_quantity": 0.5, "available_quantity": 50,
             "availability": "seasonal", "is_organic": True, "pickup_available": True,
             "delivery_available": False, "bulk_available": True, "locality": "Wayanad",
             "city": "Kalpetta", "state": "Kerala",
             "seller_name": "Mohan Das", "seller_phone": "+919876522345",
             "rating": 4.6, "images": [],
             "status": "published", "created_at": datetime.now(timezone.utc).isoformat()},
            {"seller_id": "demo", "product_name": "Country Eggs (Farm Fresh)", "category": "Poultry & Dairy",
             "description": "Free-range country eggs, no hormones. Available daily. Min order 6 eggs.",
             "unit": "piece", "price": 15.0, "min_quantity": 6, "available_quantity": 300,
             "availability": "available", "is_organic": True, "pickup_available": True,
             "delivery_available": True, "bulk_available": True, "locality": "Kozhikode",
             "city": "Kozhikode", "state": "Kerala",
             "seller_name": "Fatima Rasheed", "seller_phone": "+919876523456",
             "rating": 4.8, "images": [],
             "status": "published", "created_at": datetime.now(timezone.utc).isoformat()},
            {"seller_id": "demo", "product_name": "Fresh Coconuts", "category": "Nuts & Dry Fruits",
             "description": "Fresh tender coconuts and mature coconuts directly from farm. Bulk orders welcome.",
             "unit": "piece", "price": 30.0, "min_quantity": 5, "available_quantity": 500,
             "availability": "available", "is_organic": False, "pickup_available": True,
             "delivery_available": True, "bulk_available": True, "locality": "Thrissur",
             "city": "Thrissur", "state": "Kerala",
             "seller_name": "Kerala Coconut Farm", "seller_phone": "+919876524567",
             "rating": 4.2, "images": [],
             "status": "published", "created_at": datetime.now(timezone.utc).isoformat()},
        ])
        logger.info("Demo agriculture seeded")

    # Seed demo services
    if not await db.services.find_one({"status": "published"}):
        await db.services.insert_many([
            {"provider_id": "demo", "provider_name": "Kumar Electricals",
             "service_name": "Electrical Repairs & Installation", "category": "Electrician",
             "description": "Professional electrical services — wiring, repairs, DB box installation, AC fitting",
             "starting_price": 300.0, "hourly_price": 150.0, "visit_charge": 100.0,
             "phone": "+919876501234",
             "locality": "Kozhikode", "city": "Kozhikode",
             "state": "Kerala", "service_radius": 10, "experience_years": 8,
             "working_days": ["Mon","Tue","Wed","Thu","Fri","Sat"],
             "opening_time": "08:00", "closing_time": "20:00",
             "emergency_available": True, "price_negotiable": True, "booking_required": False,
             "languages": ["Malayalam", "English"],
             "status": "published", "rating": 4.6, "completed_jobs": 120,
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"provider_id": "demo", "provider_name": "CleanSweep Services",
             "service_name": "Home & Office Deep Cleaning", "category": "Cleaning Services",
             "description": "Deep cleaning, regular housekeeping, sofa/carpet cleaning, post-construction cleanup",
             "starting_price": 500.0, "hourly_price": 200.0, "visit_charge": 0.0,
             "phone": "+919876502345",
             "locality": "Kozhikode", "city": "Kozhikode",
             "state": "Kerala", "service_radius": 8, "experience_years": 5,
             "working_days": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
             "opening_time": "07:00", "closing_time": "19:00",
             "emergency_available": False, "price_negotiable": True, "booking_required": True,
             "languages": ["Malayalam", "Hindi"],
             "status": "published", "rating": 4.3, "completed_jobs": 85,
             "created_at": datetime.now(timezone.utc).isoformat()},
            {"provider_id": "demo", "provider_name": "QuickFix Plumbing",
             "service_name": "Plumbing & Pipe Repairs", "category": "Plumber",
             "description": "Leak fixing, pipe installation, bathroom fittings, water pump repair",
             "starting_price": 200.0, "hourly_price": 120.0, "visit_charge": 80.0,
             "phone": "+919876503456",
             "locality": "Thrissur", "city": "Thrissur",
             "state": "Kerala", "service_radius": 12, "experience_years": 10,
             "working_days": ["Mon","Tue","Wed","Thu","Fri","Sat"],
             "opening_time": "08:30", "closing_time": "19:00",
             "emergency_available": True, "price_negotiable": False, "booking_required": False,
             "languages": ["Malayalam"],
             "status": "published", "rating": 4.5, "completed_jobs": 210,
             "created_at": datetime.now(timezone.utc).isoformat()},
        ])
        logger.info("Demo services seeded")
    else:
        # Update existing services missing phone field
        await db.services.update_many(
            {"status": "published", "phone": {"$exists": False}},
            {"$set": {"phone": "+919876500000"}}
        )

    # Backfill seller_phone on existing agriculture listings that lack it
    await db.agriculture.update_many(
        {"status": "published", "seller_phone": {"$exists": False}},
        {"$set": {"seller_phone": "+919876520000"}}
    )

    # Seed demo classifieds
    if not await db.classifieds.find_one({"status": "published"}):
        await db.classifieds.insert_many([
            {"seller_id": "demo", "seller_name": "Arun K", "seller_phone": "+919876541234",
             "title": "Honda Activa 6G 2022 — Excellent Condition",
             "category": "Vehicles & Bikes", "condition": "like_new",
             "price": 72000.0, "is_negotiable": True,
             "description": "Single owner, 8500 km driven, all papers up to date, insurance valid till 2026. Minor scratches only. Selling due to upgrade.",
             "locality": "Kozhikode", "city": "Kozhikode", "state": "Kerala",
             "contact_preference": "phone", "view_count": 42,
             "status": "published", "created_at": datetime.now(timezone.utc).isoformat()},
            {"seller_id": "demo", "seller_name": "Priya Nair", "seller_phone": "+919876542345",
             "title": "Samsung Galaxy A52s — 128GB, 6GB RAM",
             "category": "Mobile Phones & Tablets", "condition": "good",
             "price": 14500.0, "is_negotiable": True,
             "description": "1.5 years old, original box and charger included. No screen damage. Battery health 88%. Selling because I switched to iPhone.",
             "locality": "Thrissur", "city": "Thrissur", "state": "Kerala",
             "contact_preference": "phone", "view_count": 28,
             "status": "published", "created_at": datetime.now(timezone.utc).isoformat()},
            {"seller_id": "demo", "seller_name": "Mohan Das", "seller_phone": "+919876543456",
             "title": "2 BHK Flat for Rent — Near City Centre",
             "category": "Real Estate", "condition": "new",
             "price": 9000.0, "is_negotiable": False,
             "description": "Fully furnished 2BHK flat, 900 sqft. AC in master bedroom, modular kitchen, 24h security, covered parking. Near Palayam Bus Stand.",
             "locality": "Kozhikode", "city": "Kozhikode", "state": "Kerala",
             "contact_preference": "phone", "view_count": 15,
             "status": "published", "created_at": datetime.now(timezone.utc).isoformat()},
            {"seller_id": "demo", "seller_name": "Reshma VP", "seller_phone": "+919876544567",
             "title": "Wooden Study Table with Shelf",
             "category": "Furniture & Home Decor", "condition": "good",
             "price": 2800.0, "is_negotiable": True,
             "description": "Teak wood study table with attached bookshelf. Dimensions: 4ft x 2ft. Very sturdy, minor surface scratches. Moving out, must sell.",
             "locality": "Wayanad", "city": "Kalpetta", "state": "Kerala",
             "contact_preference": "phone", "view_count": 9,
             "status": "published", "created_at": datetime.now(timezone.utc).isoformat()},
        ])
        logger.info("Demo classifieds seeded")

    # Seed demo discount
    if not await db.discounts.find_one({"is_active": True}):
        await db.discounts.insert_one({
            "name": "NAMCOS Welcome Offer", "description": "Pay with NAMCOS & get ₹100 OFF on orders above ₹1,000",
            "discount_type": "fixed", "discount_value": 100.0, "min_invoice_amount": 1000.0,
            "max_discount": 100.0, "store_id": None, "is_active": True,
            "usage_limit": 10000, "per_customer_limit": 1, "usage_count": 0,
            "created_by": "system", "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Demo discount seeded")

    # Seed platform settings
    if not await db.settings.find_one({"key": "platform"}):
        await db.settings.insert_one({
            "key": "platform", "max_distance_km": 20,
            "platform_fee_percent": 2.0, "namcos_earning_percent": 2.0,
            "referral_percent": 5.0, "min_withdrawal_amount": 100,
            "maintenance_mode": False, "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Platform settings seeded")
    else:
        await db.settings.update_one(
            {"key": "platform", "namcos_earning_percent": {"$exists": False}},
            {"$set": {"namcos_earning_percent": 2.0}})
        await db.settings.update_one(
            {"key": "platform", "referral_percent": {"$exists": False}},
            {"$set": {"referral_percent": 5.0}})

    # Seed default banner
    if not await db.banners.find_one():
        await db.banners.insert_one({
            "title": "Welcome to NAMCOS", "subtitle": "Discover local businesses near you",
            "image_url": "", "cta_text": "Explore Now", "cta_link": "/customer/explore",
            "is_active": True, "display_order": 1,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Default banner seeded")

    # Seed a demo merchant that owns the demo listings (so merchant portal works e2e)
    merchant_phone = "+919876543210"
    merch = await db.users.find_one({"phone": merchant_phone})
    if not merch:
        res = await db.users.insert_one({
            "phone": merchant_phone, "name": "Rajesh Kumar",
            "profile_photo": None, "roles": ["customer", "merchant"], "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()})
        merch_id = str(res.inserted_id)
    else:
        merch_id = str(merch["_id"])
        if "merchant" not in merch.get("roles", []):
            await db.users.update_one({"_id": merch["_id"]}, {"$addToSet": {"roles": "merchant"}})
    # Reassign demo-owned listings & payments to the real merchant
    for col, fields in [
        (db.stores, ["owner_id"]), (db.products, ["merchant_id"]),
        (db.agriculture, ["seller_id"]), (db.services, ["provider_id"]),
        (db.classifieds, ["seller_id"]),
        (db.orders, ["merchant_id"]), (db.payments, ["merchant_id"]),
        (db.settlements, ["merchant_id"]),
    ]:
        for f in fields:
            await col.update_many({f: "demo"}, {"$set": {f: merch_id}})

    # Seed default shop subcategories (approved) if none exist
    if not await db.subcategories.find_one({"category": "shops"}):
        shop_subs = ["Grocery & Supermarket", "Jewellery", "Electronics", "Fashion & Clothing",
                     "Pharmacy & Medical", "Bakery & Sweets", "Hardware & Tools", "Stationery & Books",
                     "Mobile & Accessories", "Footwear", "Furniture", "Gifts & Toys"]
        await db.subcategories.insert_many([
            {"name": n, "slug": n.lower().replace(" & ", "-").replace(" ", "-"),
             "category": "shops", "status": "approved", "is_active": True,
             "created_at": datetime.now(timezone.utc).isoformat()} for n in shop_subs])
        logger.info("Shop subcategories seeded")

    # Seed business types catalogue (for register-business autocomplete)
    if await db.business_types.count_documents({}) == 0:
        BIZ_TYPES = [
            "Supermarket","Grocery Store","Kirana Store","Departmental Store","Hypermarket",
            "Bakery","Sweet Shop","Confectionery","Cake Shop","Chocolate Shop",
            "Restaurant","Cafe","Coffee Shop","Tea Stall","Fast Food Outlet","Juice Bar",
            "Ice Cream Parlour","Pizza Outlet","Biryani Centre","Food Truck","Catering Service",
            "Cloud Kitchen","Dhaba","Bar & Restaurant","Fine Dining","Food Court Stall",
            "Jewellery Store","Gold Jewellery","Silver Jewellery","Imitation Jewellery","Watch Shop",
            "Clothing Store","Men's Wear","Women's Wear","Kids Wear","Boutique","Tailoring Shop",
            "Saree Shop","Ethnic Wear","Footwear Store","Bag & Luggage Store","Fashion Accessories",
            "Electronics Store","Mobile Phone Shop","Computer Store","Laptop Store","Home Appliances Store",
            "TV & Audio Store","Camera Shop","Gaming Store","Mobile Repair Shop","Electronics Repair",
            "Pharmacy","Medical Store","Chemist","Ayurvedic Store","Homeopathy Store",
            "Optical Store","Hearing Aid Centre","Surgical Supplies","Health Supplements Store",
            "Hardware Store","Paint Shop","Sanitary Ware Shop","Electrical Shop","Plumbing Supplies",
            "Tools & Machinery","Building Materials","Cement & Steel Dealer","Tiles & Marble Store",
            "Glass & Aluminium Shop","Timber & Plywood Store",
            "Stationery Shop","Book Store","Gift Shop","Toy Store","Sports Store",
            "Musical Instruments Store","Art & Craft Store","Printing & Xerox","Photo Studio",
            "Furniture Store","Home Decor Store","Mattress Store","Kitchenware Store","Crockery Store",
            "Curtain & Furnishing Store","Carpet Store","Lighting Store",
            "Supermart","Provision Store","Fruit Shop","Vegetable Shop","Fish Market",
            "Meat Shop","Chicken Shop","Dairy Store","Milk Booth","Egg Store",
            "Cosmetics Store","Beauty Products Store","Perfume Shop","Salon","Beauty Parlour",
            "Spa","Barber Shop","Hair Studio","Nail Studio","Tattoo Studio",
            "Gym","Fitness Centre","Yoga Studio","Sports Academy","Swimming Pool",
            "Mobile Accessories Shop","SIM Card Store","Recharge Shop","Internet Cafe","Gaming Zone",
            "Hotel","Lodge","Guest House","Resort","Homestay","Banquet Hall","Event Management",
            "Travel Agency","Tour Operator","Car Rental","Bike Rental","Taxi Service",
            "Petrol Pump","Gas Agency","Automobile Showroom","Car Dealer","Bike Dealer",
            "Car Service Centre","Bike Service Centre","Spare Parts Shop","Tyre Shop","Car Wash",
            "Hospital","Clinic","Dental Clinic","Eye Clinic","Diagnostic Centre","Pathology Lab",
            "Veterinary Clinic","Physiotherapy Centre","Child Care Clinic","Nursing Home",
            "School","Coaching Centre","Tuition Centre","Play School","Dance Academy","Music School",
            "Computer Training Institute","Driving School","Library","Language Institute",
            "Bank","ATM","Insurance Agency","Finance Company","Chit Fund","Money Transfer",
            "Boutique Hotel","Pet Shop","Aquarium Store","Plant Nursery","Florist","Garden Centre",
            "Laundry","Dry Cleaning","Cobbler","Key Maker","Watch Repair","Courier Service",
            "Packers & Movers","Real Estate Agency","Property Dealer","Interior Designer","Architect Firm",
            "Advertising Agency","Printing Press","Signage Shop","Mobile Money Shop","Cyber Cafe",
        ]
        now = datetime.now(timezone.utc).isoformat()
        await db.business_types.insert_many(
            [{"name": n, "is_active": True, "created_at": now} for n in BIZ_TYPES])
        logger.info(f"Business types seeded ({len(BIZ_TYPES)})")

    # Ensure every store has a discount_percent; give demo stores sample discounts
    demo_discounts = {"Green Mart": 10, "Spice Garden Restaurant": 15,
                      "TechHub Electronics": 8, "Style Hub Fashion": 20}
    for name, pct in demo_discounts.items():
        await db.stores.update_one(
            {"business_name": name, "discount_percent": {"$exists": False}},
            {"$set": {"discount_percent": pct}})
    await db.stores.update_many(
        {"discount_percent": {"$exists": False}}, {"$set": {"discount_percent": 0}})
    # Default per-store referral/chain/namcos allocation (admin can edit per store)
    await db.stores.update_many(
        {"referral_percent": {"$exists": False}}, {"$set": {"referral_percent": 1.0}})
    await db.stores.update_many(
        {"chain_percent": {"$exists": False}}, {"$set": {"chain_percent": 1.0}})
    await db.stores.update_many(
        {"namcos_percent": {"$exists": False}}, {"$set": {"namcos_percent": 3.0}})

    # Backfill referral codes for users missing one
    import secrets
    async for u in db.users.find({"referral_code": {"$exists": False}}):
        code = "NAM" + secrets.token_hex(3).upper()
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"referral_code": code}})

    # Write test credentials
    creds = Path("/app/memory/test_credentials.md")
    creds.parent.mkdir(exist_ok=True)
    creds.write_text(f"""# NAMCOS Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Roles: admin, super_admin
- Login URL: /admin (email + password login)

## Customer / Merchant Account
- Login via Phone OTP at /auth
- REAL SMS via Twilio Verify for normal numbers (OTP is NOT returned in API response)
- Test numbers (no SMS, fixed OTP {os.environ.get("OTP_TEST_CODE")}): {os.environ.get("OTP_TEST_PHONES")}

## Demo Merchant (owns all demo listings & payments)
- Phone: +919876543210  (Name: Rajesh Kumar, roles: customer + merchant)
- Login via Phone OTP at /auth, then open the Merchant portal
- Sees demo stores, orders, payments (with customer phone) and balance

## Auth Endpoints
- POST /api/auth/send-otp  → {{phone: "+91XXXXXXXXXX"}}
- POST /api/auth/verify-otp → {{phone, otp, name}}
- POST /api/auth/admin-login → {{email, password}}
- GET  /api/auth/me
- POST /api/auth/logout

## Payment Test Flow (Mock Mode)
1. POST /api/orders → get order_id
2. POST /api/payments/initiate → {{order_id}} → get transaction_id
3. POST /api/payments/mock-success → {{transaction_id}}
""")
    logger.info("Test credentials file written")

@app.on_event("startup")
async def startup():
    await create_indexes()
    await seed_data()
    try:
        init_storage()
    except Exception as e:
        logger.warning(f"Storage init deferred: {e}")

@app.on_event("shutdown")
async def shutdown():
    client.close()

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "NAMCOS API v1.0"}
