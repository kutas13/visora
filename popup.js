// Popup script for Vize Form Doldur extension

class ProfileManager {
  constructor() {
    this.profiles = [];
    this.activeProfile = null;
    this.init();
  }

  async init() {
    await this.loadProfiles();
    this.setupEventListeners();
    this.updateProfileSelect();
  }

  // Load profiles from Chrome storage
  async loadProfiles() {
    try {
      const result = await chrome.storage.sync.get(['profiles', 'activeProfile']);
      this.profiles = result.profiles || [];
      this.activeProfile = result.activeProfile || null;
    } catch (error) {
      console.error('Profil yükleme hatası:', error);
      this.showStatus('Profiller yüklenemedi!', 'error');
    }
  }

  // Save profiles to Chrome storage
  async saveProfiles() {
    try {
      await chrome.storage.sync.set({
        profiles: this.profiles,
        activeProfile: this.activeProfile
      });
      return true;
    } catch (error) {
      console.error('Profil kaydetme hatası:', error);
      this.showStatus('Profil kaydedilemedi!', 'error');
      return false;
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Add new profile button
    document.getElementById('addProfile').addEventListener('click', () => {
      this.addNewProfile();
    });

    // Profile selector
    document.getElementById('profileSelect').addEventListener('change', (e) => {
      this.selectProfile(e.target.value);
    });

    // Delete profile button
    document.getElementById('deleteProfile').addEventListener('click', () => {
      this.deleteCurrentProfile();
    });

    // Save profile button
    document.getElementById('saveProfile').addEventListener('click', () => {
      this.saveCurrentProfile();
    });

    // Fill form button
    document.getElementById('fillForm').addEventListener('click', () => {
      this.fillWebForm();
    });

    // Form inputs change handler
    const inputs = document.querySelectorAll('#profileForm input');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.markFormAsChanged();
      });
    });
  }

  // Update profile selector dropdown
  updateProfileSelect() {
    const select = document.getElementById('profileSelect');
    select.innerHTML = '<option value="">Profil Seçin</option>';
    
    this.profiles.forEach((profile, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = profile.name || `Profil ${index + 1}`;
      if (this.activeProfile === index) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    this.updateFormVisibility();
    this.updateDeleteButton();
  }

  // Add new profile
  addNewProfile() {
    const newProfile = {
      name: `Profil ${this.profiles.length + 1}`,
      firstName: '',
      lastName: '',
      tcNo: '',
      passportNo: '',
      gender: ''
    };

    this.profiles.push(newProfile);
    this.activeProfile = this.profiles.length - 1;
    this.updateProfileSelect();
    this.loadProfileToForm();
    this.showStatus('Yeni profil eklendi!', 'success');
  }

  // Select a profile
  selectProfile(index) {
    if (index === '') {
      this.activeProfile = null;
    } else {
      this.activeProfile = parseInt(index);
      this.loadProfileToForm();
    }
    this.updateFormVisibility();
    this.updateDeleteButton();
  }

  // Delete current profile
  async deleteCurrentProfile() {
    if (this.activeProfile === null || this.profiles.length === 0) {
      this.showStatus('Silinecek profil yok!', 'error');
      return;
    }

    const profileName = this.profiles[this.activeProfile].name;
    const confirmed = confirm(`"${profileName}" profilini silmek istediğinizden emin misiniz?`);
    
    if (confirmed) {
      this.profiles.splice(this.activeProfile, 1);
      this.activeProfile = this.profiles.length > 0 ? 0 : null;
      
      if (await this.saveProfiles()) {
        this.updateProfileSelect();
        if (this.activeProfile !== null) {
          this.loadProfileToForm();
        } else {
          this.clearForm();
        }
        this.showStatus('Profil silindi!', 'success');
      }
    }
  }

  // Save current profile
  async saveCurrentProfile() {
    const formData = this.getFormData();
    
    // Validation
    if (!formData.profileName.trim()) {
      this.showStatus('Profil adı boş olamaz!', 'error');
      return;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      this.showStatus('Ad ve soyad boş olamaz!', 'error');
      return;
    }

    if (!formData.tcNo.trim() || formData.tcNo.length !== 11) {
      this.showStatus('TC Kimlik No 11 haneli olmalı!', 'error');
      return;
    }

    if (!formData.gender) {
      this.showStatus('Cinsiyet seçmelisiniz!', 'error');
      return;
    }

    // Create or update profile
    const profileData = {
      name: formData.profileName,
      firstName: formData.firstName,
      lastName: formData.lastName,
      tcNo: formData.tcNo,
      passportNo: formData.passportNo,
      gender: formData.gender
    };

    if (this.activeProfile === null) {
      // Create new profile
      this.profiles.push(profileData);
      this.activeProfile = this.profiles.length - 1;
    } else {
      // Update existing profile
      this.profiles[this.activeProfile] = profileData;
    }

    if (await this.saveProfiles()) {
      this.updateProfileSelect();
      this.showStatus('Profil başarıyla kaydedildi! ✅', 'success');
    }
  }

  // Fill web form with current profile data
  async fillWebForm() {
    if (this.activeProfile === null) {
      this.showStatus('Önce bir profil seçin!', 'error');
      return;
    }

    const profile = this.profiles[this.activeProfile];
    
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('consular.mfa.gov.cn')) {
        this.showStatus('Lütfen vize başvuru sayfasında olduğunuzdan emin olun!', 'error');
        return;
      }

      // Send profile data to content script
      await chrome.tabs.sendMessage(tab.id, {
        action: 'fillForm',
        data: profile
      });

      this.showStatus('Form dolduruldu! 🚀', 'success');
      
    } catch (error) {
      console.error('Form doldurma hatası:', error);
      this.showStatus('Form doldurulamadı! Sayfayı yenileyin.', 'error');
    }
  }

  // Get form data from inputs
  getFormData() {
    return {
      profileName: document.getElementById('profileName').value,
      firstName: document.getElementById('firstName').value,
      lastName: document.getElementById('lastName').value,
      tcNo: document.getElementById('tcNo').value,
      passportNo: document.getElementById('passportNo').value,
      gender: document.querySelector('input[name="gender"]:checked')?.value || ''
    };
  }

  // Load profile data to form
  loadProfileToForm() {
    if (this.activeProfile === null || !this.profiles[this.activeProfile]) {
      this.clearForm();
      return;
    }

    const profile = this.profiles[this.activeProfile];
    
    document.getElementById('profileName').value = profile.name || '';
    document.getElementById('firstName').value = profile.firstName || '';
    document.getElementById('lastName').value = profile.lastName || '';
    document.getElementById('tcNo').value = profile.tcNo || '';
    document.getElementById('passportNo').value = profile.passportNo || '';
    
    // Set gender radio button
    if (profile.gender) {
      const genderRadio = document.querySelector(`input[name="gender"][value="${profile.gender}"]`);
      if (genderRadio) {
        genderRadio.checked = true;
      }
    }
  }

  // Clear form
  clearForm() {
    document.getElementById('profileName').value = '';
    document.getElementById('firstName').value = '';
    document.getElementById('lastName').value = '';
    document.getElementById('tcNo').value = '';
    document.getElementById('passportNo').value = '';
    document.querySelectorAll('input[name="gender"]').forEach(radio => {
      radio.checked = false;
    });
  }

  // Update form visibility
  updateFormVisibility() {
    const formSection = document.getElementById('profileForm');
    if (this.profiles.length > 0) {
      formSection.style.display = 'block';
    } else {
      formSection.style.display = 'block'; // Always show form for adding new profiles
    }
  }

  // Update delete button state
  updateDeleteButton() {
    const deleteBtn = document.getElementById('deleteProfile');
    deleteBtn.disabled = this.activeProfile === null || this.profiles.length === 0;
    deleteBtn.style.opacity = deleteBtn.disabled ? '0.5' : '1';
  }

  // Mark form as changed (for future save indication)
  markFormAsChanged() {
    // Could add visual indication that form has unsaved changes
  }

  // Show status message
  showStatus(message, type = 'success') {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.classList.remove('hidden');

    // Auto hide after 3 seconds
    setTimeout(() => {
      statusEl.classList.add('hidden');
    }, 3000);
  }
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', () => {
  new ProfileManager();
});

// Handle TC input formatting
document.getElementById('tcNo').addEventListener('input', function(e) {
  // Only allow numbers
  this.value = this.value.replace(/[^0-9]/g, '');
  
  // Limit to 11 digits
  if (this.value.length > 11) {
    this.value = this.value.substr(0, 11);
  }
});