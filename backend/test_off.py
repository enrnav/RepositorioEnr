import urllib.request
import urllib.parse
import json

def search_open_food_facts(query):
    try:
        url = "https://mx.openfoodfacts.org/cgi/search.pl?search_terms=" + urllib.parse.quote(query) + "&search_simple=1&action=process&json=1"
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'AbarrotesPOS - WebApp - Version 1.0'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            
        products = data.get("products", [])
        if products:
            for p in products:
                # Look for front image
                img_url = p.get("image_front_url") or p.get("image_url") or p.get("image_front_small_url")
                if img_url:
                    return img_url
    except Exception as e:
        print(f"Error Open Food Facts for {query}: {e}")
    return None

if __name__ == "__main__":
    queries = ["salsa valentina", "coca cola 600ml", "papas sabritas", "leche lala", "barritas fresa marinela"]
    for q in queries:
        img = search_open_food_facts(q)
        print(f"Query: {q} => Image: {img}")
