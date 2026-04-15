// Content script for Vize Form Doldur extension
// This script runs on the visa form page and handles form filling

class ViseFormFiller {
  constructor() {
    this.init();
  }

  init() {
    console.log('Vize Form Doldur eklentisi yüklendi');
    this.setupMessageListener();
  }

  // Listen for messages from popup
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'fillForm') {
        this.fillForm(message.data);
        sendResponse({ success: true });
      }
    });
  }

  // Main form filling function
  async fillForm(profileData) {
    console.log('Form doldurma başladı:', profileData);
    
    try {
      // Wait for page to be ready
      await this.waitForPageReady();

      // Step 1: Select Turkey (Türkiye)
      await this.selectCountry();

      // Step 2: Fill name fields
      await this.fillNameFields(profileData.firstName, profileData.lastName);

      // Step 3: Select gender
      await this.selectGender(profileData.gender);

      // Step 4: Fill TC number
      await this.fillTCNumber(profileData.tcNo);

      // Step 5: Set nationality questions to "No"
      await this.setNationalityQuestions();

      // Step 6: Select "Ordinary" passport type
      await this.selectPassportType();

      // Step 7: Fill passport number
      await this.fillPassportNumber(profileData.passportNo);

      console.log('Form başarıyla dolduruldu!');
      this.showNotification('Form başarıyla dolduruldu! ✅', 'success');

    } catch (error) {
      console.error('Form doldurma hatası:', error);
      this.showNotification('Form doldurulamadı: ' + error.message, 'error');
    }
  }

  // Wait for page to be ready
  waitForPageReady() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve);
      }
    });
  }

  // Wait for element to appear
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element bulunamadı: ${selector}`));
      }, timeout);
    });
  }

  // Select Turkey from country dropdown
  async selectCountry() {
    try {
      // First find and click the country input to open dropdown
      const countryInput = await this.waitForElement('input[placeholder="Please select."]');
      
      // Click to open dropdown
      countryInput.click();
      await this.sleep(500);

      // Find and click Turkey option
      const turkeyOption = await this.waitForElement('div[data-v-6f8b919e=""]:contains("Türkiye")', 3000);
      if (!turkeyOption) {
        // Try alternative selector
        const options = document.querySelectorAll('div[data-v-6f8b919e=""]');
        for (let option of options) {
          if (option.textContent.includes('Türkiye') || option.textContent.includes('Turkey')) {
            option.click();
            await this.sleep(300);
            return;
          }
        }
        throw new Error('Türkiye seçeneği bulunamadı');
      }

      turkeyOption.click();
      await this.sleep(300);
      
    } catch (error) {
      console.error('Ülke seçimi hatası:', error);
      throw new Error('Türkiye seçilemedi');
    }
  }

  // Fill name fields (first and last name)
  async fillNameFields(firstName, lastName) {
    try {
      // Find all text inputs with the specific pattern
      const nameInputs = document.querySelectorAll('input[type="text"][maxlength="80"][placeholder="Please enter."]');
      
      if (nameInputs.length < 2) {
        throw new Error('Ad ve soyad alanları bulunamadı');
      }

      // Fill first name (first input)
      this.fillInput(nameInputs[0], firstName);
      await this.sleep(300);

      // Fill last name (second input)
      this.fillInput(nameInputs[1], lastName);
      await this.sleep(300);

    } catch (error) {
      console.error('Ad soyad doldurma hatası:', error);
      throw new Error('Ad ve soyad doldurulamadı');
    }
  }

  // Select gender
  async selectGender(gender) {
    try {
      // Find gender radio buttons
      const radioButtons = document.querySelectorAll('.el-radio__inner');
      
      if (radioButtons.length < 2) {
        throw new Error('Cinsiyet seçenekleri bulunamadı');
      }

      // Select based on gender (assuming first is male, second is female)
      let targetIndex = 0;
      if (gender === 'female') {
        targetIndex = 1;
      }

      radioButtons[targetIndex].click();
      await this.sleep(300);

    } catch (error) {
      console.error('Cinsiyet seçimi hatası:', error);
      throw new Error('Cinsiyet seçilemedi');
    }
  }

  // Fill TC number
  async fillTCNumber(tcNo) {
    try {
      // Find TC input (should be after name inputs)
      const tcInput = await this.waitForElement('input[type="text"][minlength="1"][maxlength="80"][placeholder="Please enter."]');
      
      this.fillInput(tcInput, tcNo);
      await this.sleep(300);

    } catch (error) {
      console.error('TC doldurma hatası:', error);
      throw new Error('TC Kimlik No doldurulamadı');
    }
  }

  // Set nationality questions to "No" (3 questions)
  async setNationalityQuestions() {
    try {
      // Find all "No" radio buttons for nationality questions
      // These should be the second radio button in each group
      const radioGroups = document.querySelectorAll('.el-radio-group');
      
      for (let i = 0; i < Math.min(3, radioGroups.length); i++) {
        const noButton = radioGroups[i].querySelectorAll('.el-radio__inner')[1]; // Second option is "No"
        if (noButton) {
          noButton.click();
          await this.sleep(200);
        }
      }

    } catch (error) {
      console.error('Uyruk soruları hatası:', error);
      throw new Error('Uyruk soruları ayarlanamadı');
    }
  }

  // Select "Ordinary" passport type
  async selectPassportType() {
    try {
      // Find passport type radio buttons
      const passportRadios = document.querySelectorAll('input[type="radio"][value="Ordinary"]');
      
      if (passportRadios.length > 0) {
        passportRadios[0].click();
        await this.sleep(300);
      } else {
        // Try alternative method - find by text content
        const radioLabels = document.querySelectorAll('.el-radio__label');
        for (let label of radioLabels) {
          if (label.textContent.includes('Ordinary')) {
            const radioInput = label.previousElementSibling?.querySelector('.el-radio__inner');
            if (radioInput) {
              radioInput.click();
              await this.sleep(300);
              return;
            }
          }
        }
        throw new Error('Ordinary seçeneği bulunamadı');
      }

    } catch (error) {
      console.error('Pasaport türü seçimi hatası:', error);
      throw new Error('Pasaport türü seçilemedi');
    }
  }

  // Fill passport number
  async fillPassportNumber(passportNo) {
    if (!passportNo) return;

    try {
      // Find passport number input (maxlength="120")
      const passportInput = await this.waitForElement('input[type="text"][maxlength="120"][placeholder="Please enter."]');
      
      this.fillInput(passportInput, passportNo);
      await this.sleep(300);

    } catch (error) {
      console.error('Pasaport numarası doldurma hatası:', error);
      throw new Error('Pasaport numarası doldurulamadı');
    }
  }

  // Helper function to fill input with proper events
  fillInput(input, value) {
    if (!input || !value) return;

    // Clear existing value
    input.value = '';
    
    // Focus the input
    input.focus();
    
    // Set value
    input.value = value;
    
    // Trigger events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Sleep function
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Show notification
  showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: bold;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease-out;
      max-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    if (type === 'success') {
      notification.style.backgroundColor = '#10b981';
    } else if (type === 'error') {
      notification.style.backgroundColor = '#dc2626';
    }

    notification.textContent = message;

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `;
    document.head.appendChild(style);

    // Add to page
    document.body.appendChild(notification);

    // Remove after 4 seconds
    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        if (style.parentNode) {
          style.parentNode.removeChild(style);
        }
      }, 300);
    }, 4000);
  }
}

// CSS helper for :contains selector
document.querySelectorAll = (function(original) {
  return function(selector) {
    if (selector.includes(':contains(')) {
      const parts = selector.split(':contains(');
      const baseSelector = parts[0];
      const text = parts[1].replace(')', '').replace(/"/g, '');
      
      const elements = original.call(document, baseSelector);
      return Array.from(elements).filter(el => el.textContent.includes(text));
    }
    return original.call(document, selector);
  };
})(document.querySelectorAll);

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ViseFormFiller();
  });
} else {
  new ViseFormFiller();
}