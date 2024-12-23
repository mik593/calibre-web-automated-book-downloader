"""Network operations manager for the book downloader application."""

import requests
import time
from io import BytesIO
import urllib.request
from typing import Optional
from urllib.parse import urlparse
from tqdm import tqdm

import cloudflare_bypasser
from logger import setup_logger
from config import MAX_RETRY, DEFAULT_SLEEP, CLOUDFLARE_PROXY, USE_CF_BYPASS

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

# TODO : if use_bypasser is True, still try first without it
def html_get_page(url: str, retry: int = MAX_RETRY, use_bypasser: bool = False, skip_404: bool = False, skip_403: bool = False) -> str:
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
            return ""
        
        if skip_404 and response.status_code == 404:
            logger.warning(f"404 error for URL: {url}")
            return ""
        
        if skip_403 and response.status_code == 403:
            logger.warning(f"403 error for URL: {url}. Should retry using cloudflare bypass.")
            return ""
            
            
        sleep_time = DEFAULT_SLEEP * (MAX_RETRY - retry + 1)
        logger.warning(
            f"Retrying GET {url} in {sleep_time} seconds due to error: {e}"
        )
        time.sleep(sleep_time)
        return html_get_page(url, retry - 1, use_bypasser)

def html_get_page_cf(url: str, retry: int = MAX_RETRY) -> Optional[str]:
    return html_get_page(url, retry - 1, use_bypasser=True)

def download_url(link: str, size: str = "") -> Optional[BytesIO]:
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

        total_size : float = 0.0
        try:
            # we assume size is in MB
            total_size = float(size.strip().replace(" ", "").replace(",", ".").upper()[:-2].strip()) * 1024 * 1024
        except:
            total_size = float(response.headers.get('content-length', 0))
        
        buffer = BytesIO()

        # Initialize the progress bar with your guess
        pbar = tqdm(total=total_size, unit='B', unit_scale=True, desc='Downloading')
        for chunk in response.iter_content(chunk_size=1000):
            buffer.write(chunk)
            pbar.update(len(chunk))
            
        pbar.close()
        return buffer
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to download from {link}: {e}")
        return None

def get_absolute_url(base_url: str, url: str) -> str:
    """Get absolute URL from relative URL and base URL.
    
    Args:
        base_url: Base URL
        url: Relative URL
    """
    if url.strip() == "":
        return ""
    if url.startswith("http"):
        return url
    parsed_url = urlparse(url)
    parsed_base = urlparse(base_url)
    if parsed_url.netloc == "" or parsed_url.scheme == "":
        parsed_url = parsed_url._replace(netloc=parsed_base.netloc, scheme=parsed_base.scheme)
    return parsed_url.geturl()
