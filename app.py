from flask import Flask, render_template, jsonify, request
import requests
import feedparser
from bs4 import BeautifulSoup
import hashlib
import re
from datetime import datetime, timezone
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
FALLBACK_FEED_URL = "https://cloud.google.com/feeds/bigquery-release-notes.xml"

# In-memory cache
cache = {
    "data": None,
    "last_fetched": None
}

def clean_text(text):
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_tags(text):
    tags = set()
    keywords_map = {
        'Preview': ['preview', 'in preview'],
        'GA': ['general availability', 'ga', 'generally available'],
        'SQL': ['sql', 'procedural', 'query syntax', 'data types'],
        'Cross-Cloud': ['cross-cloud', 'omni', 'aws', 'azure', 'salesforce'],
        'BigLake': ['biglake', 'iceberg', 'delta lake', 'parquet'],
        'ML & AI': ['ml', 'machine learning', 'gemini', 'vector search', 'embeddings', 'llm', 'ai'],
        'Data Transfer': ['data transfer', 'dts', 'ingestion', 'connector'],
        'Security & Governance': ['security', 'iam', 'encryption', 'cmek', 'governance', 'lineage', 'privacy'],
        'Performance': ['performance', 'optimization', 'speed', 'slot', 'capacity'],
        'Pipelines': ['pipeline', 'dbt', 'dataform'],
        'Storage': ['storage', 'partition', 'cluster', 'table'],
        'ODBC/JDBC': ['driver', 'odbc', 'jdbc', 'simba']
    }
    
    text_lower = text.lower()
    for tag, keywords in keywords_map.items():
        if any(kw in text_lower for kw in keywords):
            tags.add(tag)
            
    return list(tags)

def fetch_and_parse_feed():
    try:
        logging.info(f"Fetching RSS feed from {FEED_URL}")
        resp = requests.get(FEED_URL, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}, timeout=12)
        if resp.status_code != 200:
            logging.warning(f"Primary feed returned status {resp.status_code}, trying fallback URL.")
            resp = requests.get(FALLBACK_FEED_URL, headers={'User-Agent': 'Mozilla/5.0'}, timeout=12)
        
        resp.raise_for_status()
        feed = feedparser.parse(resp.content)
        
        all_updates = []
        categories_found = set()
        all_tags_found = set()
        
        for entry_idx, entry in enumerate(feed.entries):
            date_str = entry.get('title', 'Unknown Date')
            link = entry.get('link', 'https://docs.cloud.google.com/bigquery/docs/release-notes')
            
            # Fetch summary or content value
            html_content = entry.get('summary', '')
            if not html_content and hasattr(entry, 'content') and len(entry.content) > 0:
                html_content = entry.content[0].value
                
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Find sub-headers (Google uses h3 / h2 for update type like Feature, Change, Deprecation)
            headers = soup.find_all(['h2', 'h3', 'h4'])
            
            if headers:
                for h_idx, header in enumerate(headers):
                    cat_raw = header.get_text().strip()
                    cat = cat_raw if cat_raw else 'Update'
                    categories_found.add(cat)
                    
                    # Collect elements following this header until the next header
                    sub_content_nodes = []
                    curr = header.next_sibling
                    while curr and curr.name not in ['h2', 'h3', 'h4']:
                        if isinstance(curr, str):
                            txt = curr.strip()
                            if txt:
                                sub_content_nodes.append(txt)
                        else:
                            sub_content_nodes.append(str(curr))
                        curr = curr.next_sibling
                    
                    sub_html = ''.join(sub_content_nodes).strip()
                    if not sub_html:
                        # Fallback: check if header parent has content
                        continue
                        
                    sub_soup = BeautifulSoup(sub_html, 'html.parser')
                    plain_text = clean_text(sub_soup.get_text())
                    
                    if not plain_text:
                        continue
                        
                    sentences = [s.strip() for s in plain_text.split('.') if s.strip()]
                    headline = sentences[0] + '.' if sentences else plain_text
                    if len(headline) > 130:
                        headline = headline[:127] + '...'
                        
                    tags = extract_tags(plain_text + " " + cat)
                    all_tags_found.update(tags)
                    
                    item_id = hashlib.md5(f"{date_str}-{cat}-{h_idx}-{headline}".encode('utf-8')).hexdigest()[:12]
                    
                    # Cleaned HTML output with secure target="_blank" links
                    for a_tag in sub_soup.find_all('a'):
                        a_tag['target'] = '_blank'
                        a_tag['rel'] = 'noopener noreferrer'
                    
                    cleaned_html = str(sub_soup)
                    
                    tweet_default = (
                        f"🚀 BigQuery {cat} ({date_str}):\n\n"
                        f"{headline}\n\n"
                        f"🔗 Details: {link}\n"
                        f"#BigQuery #GoogleCloud #DataEngineering"
                    )
                    
                    all_updates.append({
                        'id': item_id,
                        'date': date_str,
                        'category': cat,
                        'headline': headline,
                        'summary': plain_text,
                        'content_html': cleaned_html,
                        'link': link,
                        'tags': tags,
                        'tweet_default': tweet_default,
                        'entry_idx': entry_idx
                    })
            else:
                plain_text = clean_text(soup.get_text())
                if plain_text:
                    sentences = [s.strip() for s in plain_text.split('.') if s.strip()]
                    headline = sentences[0] + '.' if sentences else plain_text
                    if len(headline) > 130:
                        headline = headline[:127] + '...'
                        
                    cat = 'Update'
                    categories_found.add(cat)
                    tags = extract_tags(plain_text)
                    all_tags_found.update(tags)
                    
                    item_id = hashlib.md5(f"{date_str}-update-{entry_idx}".encode('utf-8')).hexdigest()[:12]
                    
                    for a_tag in soup.find_all('a'):
                        a_tag['target'] = '_blank'
                        a_tag['rel'] = 'noopener noreferrer'
                        
                    tweet_default = (
                        f"🚀 BigQuery Update ({date_str}):\n\n"
                        f"{headline}\n\n"
                        f"🔗 Details: {link}\n"
                        f"#BigQuery #GoogleCloud #DataEngineering"
                    )
                    
                    all_updates.append({
                        'id': item_id,
                        'date': date_str,
                        'category': cat,
                        'headline': headline,
                        'summary': plain_text,
                        'content_html': str(soup),
                        'link': link,
                        'tags': tags,
                        'tweet_default': tweet_default,
                        'entry_idx': entry_idx
                    })
                    
        sorted_categories = sorted(list(categories_found))
        if 'Feature' in sorted_categories:
            sorted_categories.remove('Feature')
            sorted_categories.insert(0, 'Feature')
            
        result = {
            "status": "success",
            "count": len(all_updates),
            "feed_title": feed.feed.get('title', 'BigQuery Release Notes'),
            "feed_url": FEED_URL,
            "last_fetched": datetime.now(timezone.utc).isoformat(),
            "categories": sorted_categories,
            "all_tags": sorted(list(all_tags_found)),
            "updates": all_updates
        }
        
        cache["data"] = result
        cache["last_fetched"] = datetime.now(timezone.utc)
        return result

    except Exception as e:
        logging.error(f"Error fetching or parsing feed: {e}", exc_info=True)
        if cache["data"]:
            stale_data = cache["data"].copy()
            stale_data["warning"] = f"Failed to refresh feed live. Showing cached data from {cache['last_fetched'].isoformat()}"
            return stale_data
        
        return {
            "status": "error",
            "message": str(e),
            "count": 0,
            "updates": []
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('force', 'false').lower() == 'true'
    
    if force_refresh or not cache["data"]:
        data = fetch_and_parse_feed()
    else:
        # Check cache age (15 mins)
        age = (datetime.now(timezone.utc) - cache["last_fetched"]).total_seconds()
        if age > 900:
            data = fetch_and_parse_feed()
        else:
            data = cache["data"]
            data["from_cache"] = True
            
    return jsonify(data)

@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "time": datetime.now(timezone.utc).isoformat()})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
