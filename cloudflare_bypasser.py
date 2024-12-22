import time, os
from DrissionPage import ChromiumPage
from config import MAX_RETRY, DOCKERMODE

def search_recursively_shadow_root_with_iframe(self,ele):
        if ele.shadow_root:
            if ele.shadow_root.child().tag == "iframe":
                return ele.shadow_root.child()
        else:
            for child in ele.children():
                result = self.search_recursively_shadow_root_with_iframe(child)
                if result:
                    return result
        return None

def search_recursively_shadow_root_with_cf_input(self,ele):
    if ele.shadow_root:
        if ele.shadow_root.ele("tag:input"):
            return ele.shadow_root.ele("tag:input")
    else:
        for child in ele.children():
            result = self.search_recursively_shadow_root_with_cf_input(child)
            if result:
                return result
    return None

def locate_cf_button(self):
    button = None
    eles = self.driver.eles("tag:input")
    for ele in eles:
        if "name" in ele.attrs.keys() and "type" in ele.attrs.keys():
            if "turnstile" in ele.attrs["name"] and ele.attrs["type"] == "hidden":
                button = ele.parent().shadow_root.child()("tag:body").shadow_root("tag:input")
                break
        
    if button:
        return button
    else:
        # If the button is not found, search it recursively
        self.log_message("Basic search failed. Searching for button recursively.")
        ele = self.driver.ele("tag:body")
        iframe = self.search_recursively_shadow_root_with_iframe(ele)
        if iframe:
            button = self.search_recursively_shadow_root_with_cf_input(iframe("tag:body"))
        else:
            self.log_message("Iframe not found. Button search failed.")
        return button

def click_verification_button(self):
    try:
        button = self.locate_cf_button()
        if button:
            self.log_message("Verification button found. Attempting to click.")
            button.click()
        else:
            self.log_message("Verification button not found.")

    except Exception as e:
        self.log_message(f"Error clicking verification button: {e}")

def is_bypassed(self):
    try:
        title = self.driver.title.lower()
        body = self.driver.ele("tag:body").text.lower()
        return "just a moment" not in title
    except Exception as e:
        self.log_message(f"Error checking page title: {e}")
        return False

def bypass(self, max_retries=MAX_RETRY):
    try_count = 0

    while not self.is_bypassed():
        print("Starting Cloudflare bypass...", self.max_retries + 1, try_count)
        if 0 < self.max_retries + 1 <= try_count:
            self.log_message("Exceeded maximum retries. Bypass failed.")
            break

        self.log_message(f"Attempt {try_count + 1}: Verification page detected. Trying to bypass...")
        self.click_verification_button()

        try_count += 1
        time.sleep(2)

    if self.is_bypassed():
        self.log_message("Bypass successful.")
    else:
        self.log_message("Bypass failed.")


from DrissionPage import ChromiumPage, ChromiumOptions


def get_chromium_options(arguments: list) -> ChromiumOptions:
    options = ChromiumOptions()
    for argument in arguments:
        options.set_argument(argument)
    return options

def genScraper():
    arguments = [
        "-no-first-run",
        "-force-color-profile=srgb",
        "-metrics-recording-only",
        "-password-store=basic",
        "-use-mock-keychain",
        "-export-tagged-pdf",
        "-no-default-browser-check",
        "-disable-background-mode",
        "-enable-features=NetworkService,NetworkServiceInProcess,LoadCryptoTokenExtension,PermuteTLSExtensions",
        "-disable-features=FlashDeprecationWarning,EnablePasswordsAccountStorage",
        "-deny-permission-prompts",
        "-disable-gpu",
        "-accept-lang=en-US",
    ]

    options = get_chromium_options(arguments)
    # Initialize the browser
    driver = ChromiumPage(addr_or_opts=options)
    return driver

_defaultTab = None

def reset_browser():
    if not DOCKERMODE:
        return
    global _defaultTab
    # Kill the browser
    if _defaultTab:
        _defaultTab.close()
    _defaultTab = None
    # Force kill the browser
    os.system("pkill -f *chrom*")
    time.sleep(1)

def init_browser(retry = MAX_RETRY):
    global _defaultTab
    if _defaultTab:
        return _defaultTab
    else:
        try:
            driver = genScraper()
            _defaultTab = driver.get_tabs()[0]
        except Exception as e:
            if retry > 0:
                reset_browser(retry - 1)
            else:
                raise e
    return init_browser()

def get(url, retry = MAX_RETRY):
    defaultTab = init_browser()
    defaultTab.get(url)
    cf_bypasser = CloudflareBypasser(defaultTab)
    try:
        cf_bypasser.bypass()
    except Exception as e:
        if retry > 0:
            return get(url, retry - 1)
        raise e
    return defaultTab

