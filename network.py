"""Network operations manager for the book downloader application."""

import requests
import time
from io import BytesIO
import urllib.request
from typing import Optional
import cloudflare_bypasser

from logger import setup_logger
from config import MAX_RETRY, DEFAULT_SLEEP

logger = setup_logger(__name__)

def setup_urllib_opener():
    """Configure urllib opener with appropriate headers."""
    opener = urllib.request.build_opener()
    opener.addheaders = [
        ('User-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
         'AppleWebKit/537.36 (KHTML, like Gecko) '
         'Chrome/129.0.0.0 Safari/537.3')
    ]
    urllib.request.install_opener(opener)

setup_urllib_opener()

def html_get_page(url: str, retry: int = MAX_RETRY, use_bypasser: bool = False) -> Optional[str]:
    """Fetch HTML content from a URL with retry mechanism.
    
    Args:
        url: Target URL
        retry: Number of retry attempts
        skip_404: Whether to skip 404 errors
        
    Returns:
        str: HTML content if successful, None otherwise
    """
    try:
        logger.info(f"GET: {url}")

        if use_bypasser:
            logger.info(f"Using Cloudflare Bypasser for: {url}")
            response = cloudflare_bypasser.get(url)
            logger.info(f"Cloudflare Bypasser response: {response}")
            if response:
                return response.html
            else:
                raise requests.exceptions.RequestException("Failed to bypass Cloudflare")
        response = requests.get(url)
        response.raise_for_status()
        time.sleep(1)
        return response.text
        
    except requests.exceptions.RequestException as e:
        if retry == 0:
            logger.error(f"Failed to fetch page: {url}, error: {e}")
            return None
            
        sleep_time = DEFAULT_SLEEP * (MAX_RETRY - retry + 1)
        logger.warning(
            f"Retrying GET {url} in {sleep_time} seconds due to error: {e}"
        )
        time.sleep(sleep_time)
        return html_get_page(url, retry - 1, use_bypasser)

def html_get_page_cf(url: str, retry: int = MAX_RETRY) -> Optional[str]:
    return html_get_page(url, retry - 1, use_bypasser=True)

def download_url(link: str) -> Optional[BytesIO]:
    """Download content from URL into a BytesIO buffer.
    
    Args:
        link: URL to download from
        
    Returns:
        BytesIO: Buffer containing downloaded content if successful
    """
    try:
        logger.info(f"Downloading from: {link}")
        response = requests.get(link, stream=True)
        response.raise_for_status()
        
        buffer = BytesIO()
        buffer.write(response.content)
        return buffer
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to download from {link}: {e}")
        return None