import os
import sys

try:
    from icrawler.builtin import GoogleImageCrawler
except ImportError:
    print("Error: The 'icrawler' library is missing.")
    print("Please install it by running: pip install icrawler")
    sys.exit(1)

def scrape_images_from_google(keyword, max_num=20, output_dir='dataset'):
    """
    Downloads images from Google Images into a targeted directory.
    """
    # Create the specific folder for this keyword
    keyword_folder = os.path.join(output_dir, keyword)
    
    if not os.path.exists(keyword_folder):
        os.makedirs(keyword_folder)
        
    print(f"\n🚀 Starting download for '{keyword}'...")
    print(f"📁 Saving to: {keyword_folder}")
    
    google_crawler = GoogleImageCrawler(
        feeder_threads=1,
        parser_threads=1,
        downloader_threads=4, # Use 4 threads to download faster
        storage={'root_dir': keyword_folder}
    )
    
    # We can also add filters e.g. date, size...
    # filters = dict(size='large', color='orange')
    google_crawler.crawl(
        keyword=keyword, 
        max_num=max_num, 
        # filters=filters,
        file_idx_offset='auto'
    )
    
    print(f"✅ Finished downloading images for '{keyword}'!\n")

if __name__ == "__main__":
    print("--- Web Image Scraper ---")
    
    # Interactive prompt
    search_term = input("What do you want to search for? (e.g. 'Golden Retriever'): ").strip()
    
    if not search_term:
        print("Scraping cancelled.")
        sys.exit(0)
        
    try:
        num_images = int(input("How many images do you want to download? (e.g. 20): ").strip())
    except ValueError:
        print("Invalid number. Defaulting to 10.")
        num_images = 10
        
    scrape_images_from_google(search_term, max_num=num_images)
