// Family KYC Manager - Web Portal JavaScript Controller

class FamilyKYCManager {
    constructor() {
        this.activeTab = 'dashboard';
        this.activeMember = 'head'; // Default: Vikram (Self)
        this.billingTier = 'free'; // 'free' or 'pro'
        this.billingCycle = 'monthly';
        
        // Selected Country for Localization
        this.selectedCountry = 'India';

        // Localized Data Models Initialization
        this.lifeEvents = this.getLocalizedLifeEvents('India');
        this.activeLifeEvent = 'evt-marriage';
        this.loginRole = 'head'; // 'head' or 'spouse'
        
        // Members list
        this.members = {
            head: { 
                name: 'Vikram Garg', 
                relation: 'Self', 
                avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100', 
                role: 'Head of Family',
                mobile: '+91 98765 43210',
                email: 'vikram.garg@gmail.com',
                address: 'A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi - 110075'
            },
            spouse: { name: 'Sunita Garg', relation: 'Wife', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100', role: 'Member' },
            child: { name: 'Rohan Garg', relation: 'Son (Minor)', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100', role: 'Member' },
            parent: { name: 'Ramesh Chandra Garg', relation: 'Father (Senior)', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100', role: 'Member' }
        };

        // Document Database
        this.documents = this.getLocalizedDocuments('India');

        // Alerts / KYC discrepancies list
        this.kycWarnings = [];
        this.expiryAlerts = [];
        
        // App Notification Feed (top bar)
        this.notifications = this.getLocalizedNotifications('India');

        // External Comms Simulator Log (SMS / Emails)
        this.commsLog = this.getLocalizedCommsLog('India');

        // Closed loop Action timeline log
        this.actionTimeline = [
            { time: '2026-07-25 10:00 AM', title: 'Aadhaar Verified', desc: 'Vikram Garg\'s Aadhaar Card successfully checked against UIDAI schema.', status: 'completed' },
            { time: '2026-07-24 03:20 PM', title: 'PAN Card Uploaded', desc: 'Sunita Garg\'s PAN Card added by Head of Family.', status: 'completed' }
        ];

        // Currently attached file in upload simulator
        this.uploadedFile = null;
        
        // Selected avatar URL when provisioning family members
        this.selectedMemberAvatar = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100';
    }

    init() {
        // Bind sidebar navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = item.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });

        const detected = this.detectUserCountry();
        this.setCountry(detected);
        
        // Setup Event Listeners for drag-drop
        const dropZone = document.getElementById('drag-drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileSelected(e.dataTransfer.files[0]);
                }
            });
            
            const fileInput = document.getElementById('file-input-raw');
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelected(e.target.files[0]);
                }
            });
        }

        // Close dropdowns on clicking outside
        window.addEventListener('click', (e) => {
            if (!e.target.closest('.notification-bell-container')) {
                document.getElementById('notif-dropdown').classList.add('hidden');
            }
            if (!e.target.closest('.profile-selector-container')) {
                document.getElementById('profile-dropdown').classList.add('hidden');
            }
        });

        // Floating back-to-top button behavior
        const backToTopBtn = document.getElementById('back-to-top-btn');
        if (backToTopBtn) {
            window.addEventListener('scroll', () => {
                const isMarketingVisible = !document.getElementById('marketing-page').classList.contains('hidden');
                if (isMarketingVisible && window.scrollY > 300) {
                    backToTopBtn.style.opacity = '1';
                    backToTopBtn.style.pointerEvents = 'auto';
                    backToTopBtn.style.transform = 'translateY(0)';
                } else {
                    backToTopBtn.style.opacity = '0';
                    backToTopBtn.style.pointerEvents = 'none';
                    backToTopBtn.style.transform = 'translateY(16px)';
                }
            });
        }

        this.updateMemberSelectOptions();
        this.initSupabaseCloudSync();
        this.toast("Family KYC Manager Initialized. Cloud & Local Vault Ready.", "info");
    }

    // --- LOCALIZATION & COUNTRY SPECIFIC METHODS ---
    setCountry(country) {
        this.selectedCountry = country;
        
        // Synchronize dropdown UI values
        const mSelect = document.getElementById('m-country-select');
        const dbSelect = document.getElementById('db-country-select');
        const signupSelect = document.getElementById('signup-country-select');
        if (mSelect) mSelect.value = country;
        if (dbSelect) dbSelect.value = country;
        if (signupSelect) signupSelect.value = country;
        
        // Load localized mock documents
        this.documents = this.getLocalizedDocuments(country);
        
        // Regenerate localized notifications and logs
        this.notifications = this.getLocalizedNotifications(country);
        this.commsLog = this.getLocalizedCommsLog(country);
        this.lifeEvents = this.getLocalizedLifeEvents(country);
        
        // Apply marketing copy updates
        this.updateLocalizedMarketingCopy(country);
        
        // Re-run checks
        this.runFullKYCScan();
        this.runExpiryCheck();
        this.updateMemberSelectOptions();
        this.renderAll();
        
        this.toast(`Switched localization to ${country}`, "info");
    }

    detectUserCountry() {
        try {
            // Check timezone
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (timeZone) {
                const tz = timeZone.toLowerCase();
                if (tz.includes('calcutta') || tz.includes('kolkata') || tz.includes('delhi') || tz.includes('mumbai') || tz.includes('asia/')) {
                    return 'India';
                }
                if (tz.includes('london') || tz.includes('europe/london') || tz.includes('gb') || tz.includes('uk')) {
                    return 'UK';
                }
                if (tz.includes('america') || tz.includes('us/') || tz.includes('new_york') || tz.includes('chicago') || tz.includes('los_angeles')) {
                    return 'US';
                }
            }
            
            // Check language fallback
            const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
            if (lang.includes('-in') || lang.includes('hi')) return 'India';
            if (lang.includes('-gb')) return 'UK';
            if (lang.includes('-us')) return 'US';
        } catch (e) {
            console.error("Local country detection failed: ", e);
        }
        return 'India'; // Default fallback
    }

    getLocalizedDocuments(country) {
        if (country === 'US') {
            return [
                {
                    id: 'doc-head-ssn',
                    owner: 'head',
                    type: 'SSN Card',
                    number: 'XXX-XX-1234',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: '120 Pine Street, Apt 4B, San Francisco, CA 94111',
                    fileName: 'ssn_card_vikram_garg.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-head-pan',
                    owner: 'head',
                    type: 'State ID',
                    number: 'STATE-ID-US-202',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: '120 Pine Street, Apt 4B, San Francisco, CA 94111',
                    fileName: 'state_id_vikram_garg.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-head-passport',
                    owner: 'head',
                    type: 'US Passport',
                    number: 'Passport-US-778',
                    kycName: 'Vikram G Garg',
                    kycDob: '1984-05-12',
                    kycAddress: '120 Pine Street, Apt 4B, San Francisco, CA 94111',
                    fileName: 'passport_us_vikram.pdf',
                    expiryDate: '2026-08-15',
                    status: 'warning'
                },
                {
                    id: 'doc-head-dl',
                    owner: 'head',
                    type: 'Driver\'s License',
                    number: 'DL-US-908123',
                    kycName: 'Vikaram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: '120 Pine St, Apt 4B, San Francisco, CA',
                    fileName: 'driver_license_vikram.pdf',
                    expiryDate: null,
                    status: 'warning'
                },
                {
                    id: 'doc-head-lic',
                    owner: 'head',
                    type: 'Insurance',
                    number: '•••• •••• 8123',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: '120 Pine Street, Apt 4B, San Francisco, CA 94111',
                    fileName: 'metlife_policy_bond.pdf',
                    expiryDate: '2026-07-30',
                    status: 'expired'
                },
                {
                    id: 'doc-head-bank',
                    owner: 'head',
                    type: 'Checking/Savings Bank Account',
                    number: '•••• •••• 5543',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: '120 Pine Street, Apt 4B, San Francisco, CA 94111',
                    fileName: 'chase_savings_statement.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-spouse-ssn',
                    owner: 'spouse',
                    type: 'SSN Card',
                    number: 'XXX-XX-5678',
                    kycName: 'Sunita Garg',
                    kycDob: '1987-11-20',
                    kycAddress: '120 Pine Street, Apt 4B, San Francisco, CA 94111',
                    fileName: 'ssn_card_sunita_garg.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-spouse-pan',
                    owner: 'spouse',
                    type: 'State ID',
                    number: 'STATE-ID-US-303',
                    kycName: 'Sunita Sharma',
                    kycDob: '1987-11-20',
                    kycAddress: '455 Market St, San Francisco, CA',
                    fileName: 'state_id_sunita_sharma.pdf',
                    expiryDate: null,
                    status: 'warning'
                },
                {
                    id: 'doc-spouse-dl',
                    owner: 'spouse',
                    type: 'Driver\'s License',
                    number: 'DL-US-991024',
                    kycName: 'Sunita Garg',
                    kycDob: '1987-11-20',
                    kycAddress: '120 Pine Street, Apt 4B, San Francisco, CA',
                    fileName: 'driver_license_sunita.pdf',
                    expiryDate: '2026-10-10',
                    status: 'warning'
                },
                {
                    id: 'doc-child-ssn',
                    owner: 'child',
                    type: 'SSN Card',
                    number: 'XXX-XX-9901',
                    kycName: 'Rohan Garg',
                    kycDob: '2015-08-14',
                    kycAddress: '120 Pine Street, Apt 4B, San Francisco, CA 94111',
                    fileName: 'ssn_card_rohan.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-child-passport',
                    owner: 'child',
                    type: 'US Passport',
                    number: 'Passport-US-112',
                    kycName: 'Rohan Garg',
                    kycDob: '2015-08-19',
                    kycAddress: '120 Pine Street, Apt 4B, San Francisco, CA 94111',
                    fileName: 'passport_rohan_us.pdf',
                    expiryDate: '2030-08-18',
                    status: 'warning'
                },
                {
                    id: 'doc-parent-ssn',
                    owner: 'parent',
                    type: 'SSN Card',
                    number: 'XXX-XX-4421',
                    kycName: 'Ramesh Chandra Garg',
                    kycDob: '1955-01-01',
                    kycAddress: '120 Pine Street, Apt 4B, San Francisco, CA 94111',
                    fileName: 'ssn_card_ramesh.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-parent-health',
                    owner: 'parent',
                    type: 'Medicare Card',
                    number: 'MEDICARE-998123',
                    kycName: 'Ramesh C Garg',
                    kycDob: '1955-01-01',
                    kycAddress: '120 Pine Street, Apt 4B, San Francisco, CA 94111',
                    fileName: 'medicare_card_ramesh.pdf',
                    expiryDate: '2026-07-28',
                    status: 'expired'
                },
                {
                    id: 'doc-head-degree',
                    owner: 'head',
                    type: 'Graduation Degree',
                    number: 'DEG-STANFORD-2006',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: '120 Pine Street, Apt 4B, San Francisco, CA 94111',
                    fileName: 'stanford_degree_vikram.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-head-uan',
                    owner: 'head',
                    type: 'W-2 Form',
                    number: 'W2-ADOBE-2025',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: '120 Pine Street, Apt 4B, San Francisco, CA 94111',
                    fileName: 'w2_card_vikram.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-spouse-degree',
                    owner: 'spouse',
                    type: 'Graduation Degree',
                    number: 'DEG-BERKELEY-2009',
                    kycName: 'Sunita Sharma',
                    kycDob: '1987-11-20',
                    kycAddress: '455 Market St, San Francisco, CA',
                    fileName: 'degree_sunita_sharma.pdf',
                    expiryDate: null,
                    status: 'warning'
                }
            ];
        } else if (country === 'UK') {
            return [
                {
                    id: 'doc-head-ssn',
                    owner: 'head',
                    type: 'NINO Card',
                    number: 'QQ 12 34 56 A',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'Flat 12, Kensington High Street, London W8 4SG',
                    fileName: 'nino_card_vikram_garg.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-head-pan',
                    owner: 'head',
                    type: 'National ID',
                    number: 'NAT-ID-UK-441',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'Flat 12, Kensington High Street, London W8 4SG',
                    fileName: 'national_id_vikram_garg.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-head-passport',
                    owner: 'head',
                    type: 'UK Passport',
                    number: 'Passport-UK-902',
                    kycName: 'Vikram G Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'Flat 12, Kensington High Street, London W8 4SG',
                    fileName: 'passport_uk_vikram.pdf',
                    expiryDate: '2026-08-15',
                    status: 'warning'
                },
                {
                    id: 'doc-head-dl',
                    owner: 'head',
                    type: 'Driver\'s License',
                    number: 'GARG908123UK',
                    kycName: 'Vikaram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'Flat 12, Kensington High St, London',
                    fileName: 'driver_license_uk_vikram.pdf',
                    expiryDate: null,
                    status: 'warning'
                },
                {
                    id: 'doc-head-lic',
                    owner: 'head',
                    type: 'Insurance',
                    number: '•••• •••• 8123',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'Flat 12, Kensington High Street, London W8 4SG',
                    fileName: 'aviva_policy_bond.pdf',
                    expiryDate: '2026-07-30',
                    status: 'expired'
                },
                {
                    id: 'doc-head-bank',
                    owner: 'head',
                    type: 'Current/Savings Bank Account',
                    number: '•••• •••• 9812',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'Flat 12, Kensington High Street, London W8 4SG',
                    fileName: 'barclays_statement.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-spouse-ssn',
                    owner: 'spouse',
                    type: 'NINO Card',
                    number: 'JW 65 43 21 B',
                    kycName: 'Sunita Garg',
                    kycDob: '1987-11-20',
                    kycAddress: 'Flat 12, Kensington High Street, London W8 4SG',
                    fileName: 'nino_card_sunita_garg.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-spouse-pan',
                    owner: 'spouse',
                    type: 'National ID',
                    number: 'NAT-ID-UK-442',
                    kycName: 'Sunita Sharma',
                    kycDob: '1987-11-20',
                    kycAddress: '24 Baker Street, London NW1 6XE',
                    fileName: 'national_id_sunita_sharma.pdf',
                    expiryDate: null,
                    status: 'warning'
                },
                {
                    id: 'doc-spouse-dl',
                    owner: 'spouse',
                    type: 'Driver\'s License',
                    number: 'SHAR991024UK',
                    kycName: 'Sunita Garg',
                    kycDob: '1987-11-20',
                    kycAddress: 'Flat 12, Kensington High Street, London',
                    fileName: 'driver_license_sunita_uk.pdf',
                    expiryDate: '2026-10-10',
                    status: 'warning'
                },
                {
                    id: 'doc-child-ssn',
                    owner: 'child',
                    type: 'NINO Card',
                    number: 'JW 99 88 77 C',
                    kycName: 'Rohan Garg',
                    kycDob: '2015-08-14',
                    kycAddress: 'Flat 12, Kensington High Street, London W8 4SG',
                    fileName: 'nino_card_rohan.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-child-passport',
                    owner: 'child',
                    type: 'UK Passport',
                    number: 'Passport-UK-109',
                    kycName: 'Rohan Garg',
                    kycDob: '2015-08-19',
                    kycAddress: 'Flat 12, Kensington High Street, London W8 4SG',
                    fileName: 'passport_rohan_uk.pdf',
                    expiryDate: '2030-08-18',
                    status: 'warning'
                },
                {
                    id: 'doc-parent-ssn',
                    owner: 'parent',
                    type: 'NINO Card',
                    number: 'JW 11 22 33 D',
                    kycName: 'Ramesh Chandra Garg',
                    kycDob: '1955-01-01',
                    kycAddress: 'Flat 12, Kensington High Street, London W8 4SG',
                    fileName: 'nino_card_ramesh.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-parent-health',
                    owner: 'parent',
                    type: 'NHS Medical Card',
                    number: 'NHS-998123',
                    kycName: 'Ramesh C Garg',
                    kycDob: '1955-01-01',
                    kycAddress: 'Flat 12, Kensington High Street, London W8 4SG',
                    fileName: 'nhs_medical_card_ramesh.pdf',
                    expiryDate: '2026-07-28',
                    status: 'expired'
                },
                {
                    id: 'doc-head-degree',
                    owner: 'head',
                    type: 'Graduation Degree',
                    number: 'DEG-OXFORD-2006',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'Flat 12, Kensington High Street, London W8 4SG',
                    fileName: 'oxford_degree_vikram.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-head-uan',
                    owner: 'head',
                    type: 'P60 Form',
                    number: 'P60-ADOBE-2025',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'Flat 12, Kensington High Street, London W8 4SG',
                    fileName: 'p60_form_vikram.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-spouse-degree',
                    owner: 'spouse',
                    type: 'Graduation Degree',
                    number: 'DEG-LSE-2009',
                    kycName: 'Sunita Sharma',
                    kycDob: '1987-11-20',
                    kycAddress: '24 Baker Street, London NW1 6XE',
                    fileName: 'degree_sunita_uk.pdf',
                    expiryDate: null,
                    status: 'warning'
                }
            ];
        } else {
            return [
                {
                    id: 'doc-head-aadhaar',
                    owner: 'head',
                    type: 'Aadhaar',
                    number: '5421 8976 0912',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi - 110075',
                    fileName: 'aadhaar_vikram_garg.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-head-pan',
                    owner: 'head',
                    type: 'PAN',
                    number: 'ABCDE1234F',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi - 110075',
                    fileName: 'pan_vikram_garg.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-head-passport',
                    owner: 'head',
                    type: 'Passport',
                    number: 'Z1234567',
                    kycName: 'Vikram G Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi - 110075',
                    fileName: 'passport_vikram_garg.pdf',
                    expiryDate: '2026-08-15',
                    status: 'warning'
                },
                {
                    id: 'doc-head-dl',
                    owner: 'head',
                    type: 'Voter ID',
                    number: 'DL/02/012/345678',
                    kycName: 'Vikaram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'A-402, Shanti Apts, Dwarka, Delhi - 110075',
                    fileName: 'voter_id_vikram.pdf',
                    expiryDate: null,
                    status: 'warning'
                },
                {
                    id: 'doc-head-lic',
                    owner: 'head',
                    type: 'Insurance',
                    number: '•••• •••• 5612',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi - 110075',
                    fileName: 'lic_policy_bond.pdf',
                    expiryDate: '2026-07-30',
                    status: 'expired'
                },
                {
                    id: 'doc-head-bank',
                    owner: 'head',
                    type: 'Savings Bank Account',
                    number: '•••• •••• 9812',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi - 110075',
                    fileName: 'sbi_savings_statement.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-spouse-aadhaar',
                    owner: 'spouse',
                    type: 'Aadhaar',
                    number: '9845 1209 7654',
                    kycName: 'Sunita Garg',
                    kycDob: '1987-11-20',
                    kycAddress: 'A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi - 110075',
                    fileName: 'aadhaar_sunita_garg.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-spouse-pan',
                    owner: 'spouse',
                    type: 'PAN',
                    number: 'WXYZP5678Q',
                    kycName: 'Sunita Sharma',
                    kycDob: '1987-11-20',
                    kycAddress: 'C-23, Lajpat Nagar, New Delhi - 110024',
                    fileName: 'pan_sunita_sharma.pdf',
                    expiryDate: null,
                    status: 'warning'
                },
                {
                    id: 'doc-spouse-dl',
                    owner: 'spouse',
                    type: 'Driving License',
                    number: 'DL-142010123456',
                    kycName: 'Sunita Garg',
                    kycDob: '1987-11-20',
                    kycAddress: 'A-402, Shanti Apartments, Dwarka, New Delhi',
                    fileName: 'dl_sunita_garg.pdf',
                    expiryDate: '2026-10-10',
                    status: 'warning'
                },
                {
                    id: 'doc-child-aadhaar',
                    owner: 'child',
                    type: 'Aadhaar',
                    number: '7412 8904 5621',
                    kycName: 'Rohan Garg',
                    kycDob: '2015-08-14',
                    kycAddress: 'A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi - 110075',
                    fileName: 'aadhaar_rohan.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-child-passport',
                    owner: 'child',
                    type: 'Passport',
                    number: 'V8976543',
                    kycName: 'Rohan Garg',
                    kycDob: '2015-08-19',
                    kycAddress: 'A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi - 110075',
                    fileName: 'passport_rohan_garg.pdf',
                    expiryDate: '2030-08-18',
                    status: 'warning'
                },
                {
                    id: 'doc-parent-aadhaar',
                    owner: 'parent',
                    type: 'Aadhaar',
                    number: '3029 4857 1029',
                    kycName: 'Ramesh Chandra Garg',
                    kycDob: '1955-01-01',
                    kycAddress: 'A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi - 110075',
                    fileName: 'aadhaar_ramesh_garg.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-parent-health',
                    owner: 'parent',
                    type: 'Insurance',
                    number: 'CGHS-9081234',
                    kycName: 'Ramesh C Garg',
                    kycDob: '1955-01-01',
                    kycAddress: 'A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi - 110075',
                    fileName: 'senior_citizen_health_card.pdf',
                    expiryDate: '2026-07-28',
                    status: 'expired'
                },
                {
                    id: 'doc-head-degree',
                    owner: 'head',
                    type: 'Graduation Degree',
                    number: 'DTU-BTECH-2006-8912',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi - 110075',
                    fileName: 'btech_degree_vikram.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-head-uan',
                    owner: 'head',
                    type: 'EPF UAN Card',
                    number: '100987654321',
                    kycName: 'Vikram Garg',
                    kycDob: '1984-05-12',
                    kycAddress: 'A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi - 110075',
                    fileName: 'epf_uan_card_vikram.pdf',
                    expiryDate: null,
                    status: 'valid'
                },
                {
                    id: 'doc-spouse-degree',
                    owner: 'spouse',
                    type: 'Graduation Degree',
                    number: 'MBA-FMS-2009-4501',
                    kycName: 'Sunita Sharma',
                    kycDob: '1987-11-20',
                    kycAddress: 'Lajpat Nagar, New Delhi',
                    fileName: 'mba_degree_sunita.pdf',
                    expiryDate: null,
                    status: 'warning'
                }
            ];
        }
    }

    getLocalizedNotifications(country) {
        if (country === 'US') {
            return [
                { id: 1, type: 'danger', message: 'MetLife Policy Bond expires in 4 days!', time: '2 hours ago', read: false },
                { id: 2, type: 'warning', message: 'KYC Mismatch: Name spelling in US Passport differs from SSN Card.', time: '1 day ago', read: false },
                { id: 3, type: 'danger', message: 'Medicare Health Card for Ramesh C. Garg expires in 2 days!', time: '2 days ago', read: true }
            ];
        } else if (country === 'UK') {
            return [
                { id: 1, type: 'danger', message: 'Aviva Policy Bond expires in 4 days!', time: '2 hours ago', read: false },
                { id: 2, type: 'warning', message: 'KYC Mismatch: Name spelling in UK Passport differs from NINO Card.', time: '1 day ago', read: false },
                { id: 3, type: 'danger', message: 'NHS Medical Card for Ramesh C. Garg expires in 2 days!', time: '2 days ago', read: true }
            ];
        } else {
            return [
                { id: 1, type: 'danger', message: 'LIC Policy Bond expires in 4 days!', time: '2 hours ago', read: false },
                { id: 2, type: 'warning', message: 'KYC Mismatch: Name spelling in Passport differs from Aadhaar.', time: '1 day ago', read: false },
                { id: 3, type: 'danger', message: 'Senior Citizen Health Card for Ramesh C. Garg expires in 2 days!', time: '2 days ago', read: true }
            ];
        }
    }

    getLocalizedCommsLog(country) {
        if (country === 'US') {
            return [
                {
                    id: 1,
                    channel: 'sms',
                    recipient: 'Vikram Garg (+1 555-019-2834)',
                    subject: 'Family KYC Manager ALERT',
                    body: 'ALERT: Your MetLife Policy (MET-908123) is due for renewal on 2026-07-30. Extended protections apply. Renew immediately: https://familykyc.us/r/metlife-renew',
                    timestamp: '2026-07-26 09:30 AM'
                },
                {
                    id: 2,
                    channel: 'email',
                    recipient: 'vikram.garg@gmail.com',
                    subject: 'Action Required: KYC Inconsistencies detected in Vikram G Garg Profile',
                    body: 'Dear Vikram,\n\nOur sentinel has detected a critical KYC mismatch. The spelling of your name in Driver\'s License ("Vikaram") and US Passport ("Vikram G Garg") does not match your primary identity document SSN Card ("Vikram Garg").\n\nThis discrepancy may trigger automatic failures during banking validation or employment screening. Please visit your dashboard to resolve this mismatch.\n\nRegards,\nFamily KYC Manager Guard',
                    timestamp: '2026-07-25 04:15 PM'
                }
            ];
        } else if (country === 'UK') {
            return [
                {
                    id: 1,
                    channel: 'sms',
                    recipient: 'Vikram Garg (+44 7700 900077)',
                    subject: 'Family KYC Manager ALERT',
                    body: 'ALERT: Your Aviva Policy (AV-908123) is due for renewal on 2026-07-30. Extended protections apply. Renew immediately: https://familykyc.co.uk/r/aviva-renew',
                    timestamp: '2026-07-26 09:30 AM'
                },
                {
                    id: 2,
                    channel: 'email',
                    recipient: 'vikram.garg@gmail.com',
                    subject: 'Action Required: KYC Inconsistencies detected in Vikram G Garg Profile',
                    body: 'Dear Vikram,\n\nOur sentinel has detected a critical KYC mismatch. The spelling of your name in Driver\'s License ("Vikaram") and UK Passport ("Vikram G Garg") does not match your primary identity document NINO Card ("Vikram Garg").\n\nThis discrepancy may trigger automatic failures during banking validation or housing checks. Please visit your dashboard to resolve this mismatch.\n\nRegards,\nFamily KYC Manager Guard',
                    timestamp: '2026-07-25 04:15 PM'
                }
            ];
        } else {
            return [
                {
                    id: 1,
                    channel: 'sms',
                    recipient: 'Vikram Garg (+91 98765 43210)',
                    subject: 'Family KYC Manager ALERT',
                    body: 'ALERT: Your LIC Policy (LIC-789045612) is due for renewal on 2026-07-30. Total payable: ₹15,420. Avoid lapse. Renew immediately: https://familykyc.in/r/lic-renew',
                    timestamp: '2026-07-26 09:30 AM'
                },
                {
                    id: 2,
                    channel: 'email',
                    recipient: 'vikram.garg@gmail.com',
                    subject: 'Action Required: KYC Inconsistencies detected in Vikram G Garg Profile',
                    body: 'Dear Vikram,\n\nOur sentinel has detected a critical KYC mismatch. The spelling of your name in Voter ID card ("Vikaram") and Passport ("Vikram G Garg") does not match your primary identity document Aadhaar Card ("Vikram Garg").\n\nThis discrepancy may trigger automatic failures during banking validation or visa processing. Please visit your dashboard to resolve this mismatch.\n\nRegards,\nFamily KYC Manager Guard',
                    timestamp: '2026-07-25 04:15 PM'
                }
            ];
        }
    }

    getLocalizedLifeEvents(country) {
        if (country === 'US') {
            return [
                {
                    id: 'evt-marriage',
                    title: 'Post-Marriage Name Alignment',
                    desc: 'Following marriage, name corrections must cascade across all spouse identification cards. Anchor document: Spouse SSN Card ("Sunita Garg").',
                    targetMember: 'spouse',
                    tasks: [
                        { id: 't-m-aadhaar', title: 'Verify SSN Name Update', docType: 'SSN Card', checkType: 'anchor-name', desc: 'SSN Card name must be updated with marital surname "Garg".' },
                        { id: 't-m-pan', title: 'Update State ID Card Name', docType: 'State ID', checkType: 'match-anchor-name', desc: 'State ID Card name must match SSN to prevent banking KYC blocks.' },
                        { id: 't-m-dl', title: 'Update Driver\'s License Name', docType: 'Driver\'s License', checkType: 'match-anchor-name', desc: 'Driver\'s License name should match SSN.' }
                    ],
                    progress: 0
                },
                {
                    id: 'evt-relocation',
                    title: 'Relocation Address Synchronization',
                    desc: 'After shifting residency, address details must align across all official documents. Anchor document: Primary SSN Card ("Pine Street").',
                    targetMember: 'head',
                    tasks: [
                        { id: 't-r-aadhaar', title: 'Verify SSN Address Update', docType: 'SSN Card', checkType: 'anchor-address', desc: 'SSN Card must be updated with Pine Street CA residence.' },
                        { id: 't-r-voter', title: 'Sync Driver\'s License Address', docType: 'Driver\'s License', checkType: 'match-anchor-address', desc: 'Driver\'s License address must align with Pine Street residence.' },
                        { id: 't-r-passport', title: 'Sync US Passport Address', docType: 'US Passport', checkType: 'match-anchor-address', desc: 'US Passport address should match current residency.' }
                    ],
                    progress: 0
                }
            ];
        } else if (country === 'UK') {
            return [
                {
                    id: 'evt-marriage',
                    title: 'Post-Marriage Name Alignment',
                    desc: 'Following marriage, name corrections must cascade across all spouse identification cards. Anchor document: Spouse NINO Card ("Sunita Garg").',
                    targetMember: 'spouse',
                    tasks: [
                        { id: 't-m-aadhaar', title: 'Verify NINO Name Update', docType: 'NINO Card', checkType: 'anchor-name', desc: 'NINO Card name must be updated with marital surname "Garg".' },
                        { id: 't-m-pan', title: 'Update National ID Card Name', docType: 'National ID', checkType: 'match-anchor-name', desc: 'National ID Card name must match NINO to prevent banking KYC blocks.' },
                        { id: 't-m-dl', title: 'Update Driver\'s License Name', docType: 'Driver\'s License', checkType: 'match-anchor-name', desc: 'Driver\'s License name should match NINO.' }
                    ],
                    progress: 0
                },
                {
                    id: 'evt-relocation',
                    title: 'Relocation Address Synchronization',
                    desc: 'After shifting residency, address details must align across all official documents. Anchor document: Primary NINO Card ("Kensington High St").',
                    targetMember: 'head',
                    tasks: [
                        { id: 't-r-aadhaar', title: 'Verify NINO Address Update', docType: 'NINO Card', checkType: 'anchor-address', desc: 'NINO Card must be updated with Kensington residence.' },
                        { id: 't-r-voter', title: 'Sync Driver\'s License Address', docType: 'Driver\'s License', checkType: 'match-anchor-address', desc: 'Driver\'s License address must align with Kensington residence.' },
                        { id: 't-r-passport', title: 'Sync UK Passport Address', docType: 'UK Passport', checkType: 'match-anchor-address', desc: 'UK Passport address should match current residency.' }
                    ],
                    progress: 0
                }
            ];
        } else {
            return [
                {
                    id: 'evt-marriage',
                    title: 'Post-Marriage Name Alignment',
                    desc: 'Following marriage, name corrections must cascade across all spouse identification cards. Anchor document: Spouse Aadhaar Card ("Sunita Garg").',
                    targetMember: 'spouse',
                    tasks: [
                        { id: 't-m-aadhaar', title: 'Verify Aadhaar Name Update', docType: 'Aadhaar', checkType: 'anchor-name', desc: 'Aadhaar Card name must be updated with marital surname "Garg".' },
                        { id: 't-m-pan', title: 'Update PAN Card Name', docType: 'PAN', checkType: 'match-anchor-name', desc: 'PAN Card name must match Aadhaar to prevent banking KYC blocks.' },
                        { id: 't-m-dl', title: 'Update Driving License Name', docType: 'Driving License', checkType: 'match-anchor-name', desc: 'Driving License name should match Aadhaar.' }
                    ],
                    progress: 0
                },
                {
                    id: 'evt-relocation',
                    title: 'Relocation Address Synchronization',
                    desc: 'After shifting residency, address details must align across all official documents. Anchor document: Primary Aadhaar Card ("Dwarka Apartments").',
                    targetMember: 'head',
                    tasks: [
                        { id: 't-r-aadhaar', title: 'Verify Aadhaar Address Update', docType: 'Aadhaar', checkType: 'anchor-address', desc: 'Aadhaar Card must be updated with Dwarka Sector 12 residence.' },
                        { id: 't-r-voter', title: 'Sync Voter ID Address', docType: 'Voter ID', checkType: 'match-anchor-address', desc: 'Voter ID card address must align with Dwarka residence.' },
                        { id: 't-r-passport', title: 'Sync Passport Address', docType: 'Passport', checkType: 'match-anchor-address', desc: 'Passport address should match current residency.' }
                    ],
                    progress: 0
                }
            ];
        }
    }

    updateLocalizedMarketingCopy(country) {
        const heroDesc = document.getElementById('m-hero-desc');
        const govtP = document.getElementById('m-docs-govt');
        const financialP = document.getElementById('m-docs-financial');
        const utilitiesP = document.getElementById('m-docs-utilities');
        
        if (country === 'US') {
            if (heroDesc) heroDesc.innerHTML = `Stop scrambling at the eleventh hour over expired passports, legacy licence rules, or name typos. FamilyKYCManager automatically tracks your household's expiries and alerts you before the authorities do.`;
            if (govtP) govtP.innerHTML = `Social Security (SSN)<br>US Passport<br>State Driver's License<br>Green Card / Visa`;
            if (financialP) financialP.innerHTML = `US Bank Accounts<br>401(k) / IRA Accounts<br>Medicare / Health Card<br>W-2 / 1040 Tax Forms`;
            if (utilitiesP) utilitiesP.innerHTML = `Vehicle Title & Registration<br>Property Deed & Tax<br>Electricity & Water<br>Home Internet & Mobile`;
        } else if (country === 'UK') {
            if (heroDesc) heroDesc.innerHTML = `Stop scrambling at the eleventh hour over expired passports, legacy licence rules, or name typos. FamilyKYCManager automatically tracks your household's expiries and alerts you before the authorities do.`;
            if (govtP) govtP.innerHTML = `National Insurance (NINO)<br>UK Passport<br>DVLA Driver's License<br>Biometric Permit (BRP)`;
            if (financialP) financialP.innerHTML = `UK Bank Accounts<br>ISA / Pension Statement<br>NHS Medical Card<br>P60 / HMRC Tax Forms`;
            if (utilitiesP) utilitiesP.innerHTML = `V5C Vehicle Registry<br>Council Tax Bill<br>Water & Power Bills<br>Broadband & Mobile`;
        } else {
            if (heroDesc) heroDesc.innerHTML = `Stop scrambling at the eleventh hour over expired passports, legacy licence rules, or name typos. FamilyKYCManager automatically tracks your household's expiries and alerts you before the authorities do.`;
            if (govtP) govtP.innerHTML = `PAN Card<br>Passport<br>Driving Licence<br>Voter ID<br>Aadhaar Card (Masked/Redacted)`;
            if (financialP) financialP.innerHTML = `Bank Accounts<br>Life / Health Insurance<br>Mutual Funds (Metadata Only)`;
            if (utilitiesP) utilitiesP.innerHTML = `Vehicle RC (Registration)<br>Property Tax<br>Electricity<br>Gas<br>Broadband`;
        }

        const typeSelect = document.getElementById('doc-type-select');
        if (typeSelect) {
            let optionsHtml = '';
            if (country === 'US') {
                optionsHtml = `
                    <option value="SSN Card">SSN Card (Social Security)</option>
                    <option value="State ID">State ID Card</option>
                    <option value="US Passport">US Passport</option>
                    <option value="Driver's License">Driver's License</option>
                    <option value="Medicare Card">Medicare Card</option>
                    <option value="Checking/Savings Bank Account">Checking/Savings Bank Account</option>
                    <option value="Certificate of Deposit (CD)">Certificate of Deposit (CD)</option>
                    <option value="Mutual Fund / Brokerage Portfolio">Mutual Fund / Brokerage Portfolio</option>
                    <option value="401(k) / IRA Statement">401(k) / IRA Statement</option>
                    <option value="W-2 Form">W-2 Tax Form</option>
                    <option value="Insurance">Insurance Policy (Medical/Life)</option>
                    <option value="Property Tax">Property Tax Receipt</option>
                    <option value="Utility Gas">Utility Gas Bill</option>
                    <option value="Utility Electricity">Utility Electricity Bill</option>
                    <option value="Graduation Degree">Graduation Degree</option>
                `;
            } else if (country === 'UK') {
                optionsHtml = `
                    <option value="NINO Card">NINO Card (National Insurance)</option>
                    <option value="National ID">National ID Card</option>
                    <option value="UK Passport">UK Passport</option>
                    <option value="Driver's License">DVLA Driver's License</option>
                    <option value="NHS Medical Card">NHS Medical Card</option>
                    <option value="Current/Savings Bank Account">Current/Savings Bank Account</option>
                    <option value="Cash ISA / Fixed Bond">Cash ISA / Fixed Bond</option>
                    <option value="Mutual Fund / Investment ISA">Mutual Fund / Investment ISA</option>
                    <option value="Private/State Pension Scheme">Private/State Pension Scheme</option>
                    <option value="P60 Form">P60 Tax Form</option>
                    <option value="Insurance">Insurance Policy</option>
                    <option value="Property Tax">Council Tax Bill</option>
                    <option value="Utility Gas">Utility Gas Bill</option>
                    <option value="Utility Electricity">Utility Electricity Bill</option>
                    <option value="Graduation Degree">Graduation Degree</option>
                `;
            } else {
                optionsHtml = `
                    <option value="Aadhaar">Aadhaar Card</option>
                    <option value="PAN">PAN Card</option>
                    <option value="Passport">Passport</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID">Voter ID Card</option>
                    <option value="Savings Bank Account">Savings Bank Account</option>
                    <option value="Fixed Deposit (FD) Receipt">Fixed Deposit (FD) Receipt</option>
                    <option value="Mutual Fund Portfolio">Mutual Fund Portfolio</option>
                    <option value="Public Provident Fund (PPF)">Public Provident Fund (PPF)</option>
                    <option value="ITR">Income Tax Return (ITR)</option>
                    <option value="Insurance">Insurance Policy (LIC / Health)</option>
                    <option value="Property Tax">Property Tax Receipt</option>
                    <option value="Utility Gas">Gas Bill (PNG)</option>
                    <option value="Utility Electricity">Electricity Bill</option>
                    <option value="Class 10 Certificate">Class 10 Marksheet / Certificate</option>
                    <option value="Graduation Degree">Graduation Degree</option>
                    <option value="EPF UAN Card">EPF UAN Card</option>
                `;
            }
            typeSelect.innerHTML = optionsHtml;
        }

        // Update Dynamic Form Input Labels (Aadhaar / SSN / NINO) - now generic normal OTP
        const loginOtpLabel = document.getElementById('login-otp-label');
        const signupOtpLabel = document.getElementById('signup-otp-label');
        const loginOtpInput = document.getElementById('login-otp');
        const signupOtpInput = document.getElementById('signup-otp');
        
        if (loginOtpLabel) loginOtpLabel.innerText = 'Secure 6-Digit OTP';
        if (signupOtpLabel) signupOtpLabel.innerText = 'Secure 6-Digit OTP';
        if (loginOtpInput) loginOtpInput.placeholder = 'Enter 6-digit OTP';
        if (signupOtpInput) signupOtpInput.placeholder = 'Create 6-digit OTP';

        // Update Pricing Free / Pro elements based on country
        const freePriceVal = document.getElementById('free-price-val');
        if (freePriceVal) {
            if (country === 'US') {
                freePriceVal.innerHTML = '<span class="currency">$</span>0<span class="period">/ month</span>';
            } else if (country === 'UK') {
                freePriceVal.innerHTML = '<span class="currency">£</span>0<span class="period">/ month</span>';
            } else {
                freePriceVal.innerHTML = '<span class="currency">₹</span>0<span class="period">/ month</span>';
            }
        }
        
        const proPriceVal = document.getElementById('pro-price-val');
        if (proPriceVal) {
            proPriceVal.innerHTML = this.getLocalizedPriceString(country, this.billingCycle);
        }

        const homePriceVal = document.getElementById('home-price-val');
        if (homePriceVal) {
            homePriceVal.innerHTML = this.getLocalizedPriceString(country, 'monthly');
        }
    }

    // --- KYC INCONSISTENCY RULES ENGINE ---
    runFullKYCScan() {
        this.kycWarnings = [];
        
        // Find KYC errors across active documents.
        // We only crosscheck documents belonging to the SAME user.
        // Free tier is locked to Head of Family only
        const membersList = this.billingTier === 'free' ? ['head'] : ['head', 'spouse', 'child', 'parent'];
        
        membersList.forEach(mId => {
            const memberDocs = this.documents.filter(d => d.owner === mId);
            if (memberDocs.length < 2) return; // Need at least 2 documents to cross-check
            
            // 1. Establish anchor identity (Prefer Aadhaar / SSN Card / NINO Card)
            const anchorType = this.selectedCountry === 'US' ? 'SSN Card' : (this.selectedCountry === 'UK' ? 'NINO Card' : 'Aadhaar');
            const anchorDoc = memberDocs.find(d => d.type === anchorType) || memberDocs[0];
            const correctName = anchorDoc.kycName;
            const correctDob = anchorDoc.kycDob;
            const correctAddress = anchorDoc.kycAddress;
            
            memberDocs.forEach(doc => {
                if (doc.id === anchorDoc.id) return;
                
                // Rule A: Name mismatch check
                if (doc.kycName && doc.kycName.trim().toLowerCase() !== correctName.trim().toLowerCase()) {
                    // Highlight mismatch
                    this.kycWarnings.push({
                        id: `kyc-err-${doc.id}-name`,
                        memberId: mId,
                        memberName: this.members[mId].name,
                        docType: doc.type,
                        anchorDocType: anchorDoc.type,
                        field: 'Full Name',
                        value1: correctName,
                        value2: doc.kycName,
                        doc1Id: anchorDoc.id,
                        doc2Id: doc.id,
                        severity: 'warning',
                        desc: `Name spelling mismatch: "${doc.kycName}" (on ${doc.type}) vs "${correctName}" (on ${anchorDoc.type}).`
                    });
                    
                    // Mark document as warning
                    doc.status = 'warning';
                }
                
                // Rule B: DOB mismatch check
                if (doc.kycDob && doc.kycDob !== correctDob) {
                    this.kycWarnings.push({
                        id: `kyc-err-${doc.id}-dob`,
                        memberId: mId,
                        memberName: this.members[mId].name,
                        docType: doc.type,
                        anchorDocType: anchorDoc.type,
                        field: 'Date of Birth',
                        value1: this.formatDateStr(correctDob),
                        value2: this.formatDateStr(doc.kycDob),
                        doc1Id: anchorDoc.id,
                        doc2Id: doc.id,
                        severity: 'critical', // DOB errors are high importance
                        desc: `Date of Birth discrepancy: ${this.formatDateStr(doc.kycDob)} on ${doc.type} does not match ${this.formatDateStr(correctDob)} on ${anchorDoc.type}.`
                    });
                    doc.status = 'warning';
                }

                // Rule C: Address major mismatch check
                if (doc.type !== 'Insurance' && doc.kycAddress) { // Ignore address match on insurance
                    const cleanAddr1 = this.cleanAddress(correctAddress);
                    const cleanAddr2 = this.cleanAddress(doc.kycAddress);
                    
                    if (cleanAddr1 !== cleanAddr2 && this.isAddressSignificantlyDifferent(cleanAddr1, cleanAddr2)) {
                        this.kycWarnings.push({
                            id: `kyc-err-${doc.id}-addr`,
                            memberId: mId,
                            memberName: this.members[mId].name,
                            docType: doc.type,
                            anchorDocType: anchorDoc.type,
                            field: 'Residential Address',
                            value1: correctAddress,
                            value2: doc.kycAddress,
                            doc1Id: anchorDoc.id,
                            doc2Id: doc.id,
                            severity: 'warning',
                            desc: `Address discrepancy: Mismatch detected between ${doc.type} and your primary address on ${anchorDoc.type}.`
                        });
                        doc.status = 'warning';
                    }
                }

                // Rule D: Check against Admin Profile Address (for primary user only)
                if (mId === 'head' && doc.kycAddress && this.members['head'].address) {
                    const cleanProfileAddr = this.cleanAddress(this.members['head'].address);
                    const cleanDocAddr = this.cleanAddress(doc.kycAddress);
                    
                    if (cleanProfileAddr !== cleanDocAddr && this.isAddressSignificantlyDifferent(cleanProfileAddr, cleanDocAddr)) {
                        this.kycWarnings.push({
                            id: `kyc-err-${doc.id}-profile-addr`,
                            memberId: mId,
                            memberName: this.members[mId].name,
                            docType: doc.type,
                            anchorDocType: 'Profile Settings',
                            field: 'Profile Address Alignment',
                            value1: this.members['head'].address,
                            value2: doc.kycAddress,
                            doc1Id: 'profile-settings',
                            doc2Id: doc.id,
                            severity: 'warning',
                            desc: `Profile Mismatch: Address on ${doc.type} does not match the Primary Admin Address from your Profile Settings.`
                        });
                        doc.status = 'warning';
                    }
                }
            });
        });
        
        // Update stats
        document.getElementById('stat-kyc-alerts').innerText = this.kycWarnings.length;
        document.getElementById('kyc-badge-count').innerText = this.kycWarnings.length;
        if (document.getElementById('kyc-card-badge')) {
            document.getElementById('kyc-card-badge').innerText = `${this.kycWarnings.length} Warnings`;
        }
    }

    cleanAddress(addr) {
        return addr.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    isFinancialDocumentType(type) {
        if (!type) return false;
        const lowerType = type.toLowerCase();
        return lowerType.includes('bank') || 
               lowerType.includes('saving') || 
               lowerType.includes('checking') || 
               lowerType.includes('current') || 
               lowerType.includes('mutual fund') || 
               lowerType.includes('portfolio') || 
               lowerType.includes('pension') || 
               lowerType.includes('ira') || 
               lowerType.includes('401(k)') || 
               lowerType.includes('isa') || 
               lowerType.includes('provident fund') || 
               lowerType.includes('ppf') || 
               lowerType.includes('epf') || 
               lowerType.includes('insurance') || 
               lowerType.includes('itr') || 
               lowerType.includes('fixed deposit') || 
               lowerType.includes('deposit') || 
               lowerType.includes('investment');
    }

    sanitizeFinancialNumber(number, docType) {
        if (!number) return '';
        if (this.isFinancialDocumentType(docType)) {
            if (number.includes('••••')) {
                return number;
            }
            const cleanDigits = number.replace(/[^a-zA-Z0-9]/g, '');
            if (cleanDigits.length >= 4) {
                return '•••• •••• ' + cleanDigits.slice(-4);
            }
            return '•••• •••• ' + cleanDigits;
        }
        return number;
    }

    isAddressSignificantlyDifferent(addr1, addr2) {
        // Simple logic: if one string doesn't contain a major part of the other
        // In a real system this would use Levenshtein distance or geolocation matching
        if (addr1.length < 15 || addr2.length < 15) return true;
        
        // For our demo, "A-402, Shanti Apartments, Sector 12, Dwarka, New Delhi" vs "C-23, Lajpat Nagar" is different.
        // But "A-402, Shanti Apartments..." vs "A-402, Shanti Apts, Dwarka" are minor formatting.
        if (addr1.includes('lajpatnagar') && addr2.includes('dwarka') || addr2.includes('lajpatnagar') && addr1.includes('dwarka')) {
            return true;
        }
        return false;
    }

    // --- EXPIRY & RENEWALS CALCULATIONS ---
    runExpiryCheck() {
        this.expiryAlerts = [];
        const today = new Date("2026-07-26"); // Set current time context to local time provided: 2026-07-26
        
        // Free tier only monitors head of family documents
        const docsToScan = this.billingTier === 'free'
            ? this.documents.filter(d => d.owner === 'head')
            : this.documents;

        docsToScan.forEach(doc => {
            if (!doc.expiryDate) return;
            
            const expDate = new Date(doc.expiryDate);
            const timeDiff = expDate - today;
            const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            
            let status = 'valid';
            let priority = 'info';
            let message = '';
            
            if (daysDiff <= 0) {
                status = 'expired';
                priority = 'danger';
                message = `Expired! ${doc.type} renewal was due on ${this.formatDateStr(doc.expiryDate)}.`;
            } else if (daysDiff <= 15) {
                status = 'expired';
                priority = 'danger';
                message = `URGENT Renewal: ${doc.type} expires in ${daysDiff} days (${this.formatDateStr(doc.expiryDate)}).`;
            } else if (daysDiff <= 90) {
                status = 'warning';
                priority = 'warning';
                message = `${doc.type} is expiring soon. renewal due in ${daysDiff} days.`;
            }
            
            if (status !== 'valid') {
                doc.status = status;
                this.expiryAlerts.push({
                    id: `exp-alert-${doc.id}`,
                    docId: doc.id,
                    owner: doc.owner,
                    ownerName: this.members[doc.owner].name,
                    docType: doc.type,
                    docNum: doc.number,
                    daysRemaining: daysDiff,
                    expiryDate: doc.expiryDate,
                    message: message,
                    priority: priority
                });
            }
        });
        
        // Update stats
        document.getElementById('stat-renewals').innerText = this.expiryAlerts.length;
        document.getElementById('renewal-badge-count').innerText = this.expiryAlerts.length;
        if (document.getElementById('renewals-card-badge')) {
            document.getElementById('renewals-card-badge').innerText = `${this.expiryAlerts.length} Urgent`;
        }
        
        // Calculate health percentage
        // Health = (Total Docs - Issues) / Total Docs
        const totalDocs = this.documents.length;
        const issuesCount = this.kycWarnings.length + this.expiryAlerts.length;
        const healthPercent = Math.max(0, Math.min(100, Math.round(((totalDocs - issuesCount) / totalDocs) * 100)));
        
        const healthVal = document.getElementById('stat-health');
        healthVal.innerText = `${healthPercent}%`;
        const healthSub = document.getElementById('stat-health-subtext');
        
        // Dynamic colors & text
        if (healthPercent >= 90) {
            healthVal.className = "stat-value text-success";
            healthSub.innerText = "Excellent! All looks safe.";
            document.getElementById('card-vault-health').className = "stat-card stat-success";
        } else if (healthPercent >= 70) {
            healthVal.className = "stat-value text-warning";
            healthSub.innerText = `${issuesCount} Issues Detected`;
            document.getElementById('card-vault-health').className = "stat-card stat-warning";
        } else {
            healthVal.className = "stat-value text-danger";
            healthSub.innerText = `${issuesCount} Critical Vault Issues`;
            document.getElementById('card-vault-health').className = "stat-card stat-danger";
        }
    }

    // --- TAB NAVIGATION SWITCHER ---
    switchTab(tabId) {
        this.activeTab = tabId;
        
        // Close sidebar if open on mobile screens
        const sidebar = document.querySelector('.sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            sidebar.classList.remove('mobile-open');
            if (backdrop) backdrop.classList.add('hidden');
        }

        // Manage Nav Active State
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-tab') === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Toggle Pane Visibility
        document.querySelectorAll('.tab-pane').forEach(pane => {
            if (pane.getAttribute('id') === `tab-${tabId}`) {
                pane.classList.remove('hidden');
            } else {
                pane.classList.add('hidden');
            }
        });
        
        // Update Title & Subtitle based on Tab
        const pageTitle = document.getElementById('page-title');
        const pageSubtitle = document.getElementById('page-subtitle');
        
        switch(tabId) {
            case 'dashboard':
                pageTitle.innerText = "Dashboard Overview";
                pageSubtitle.innerText = `Welcome back, ${this.members[this.activeMember].name}. Here is your family's vault safety status.`;
                break;
            case 'documents':
                pageTitle.innerText = "My Documents Vault";
                pageSubtitle.innerText = "Securely browse, search, and download your uploaded family documents.";
                break;
            case 'family':
                pageTitle.innerText = "Family Vault Controls";
                pageSubtitle.innerText = "Establish encryption scopes and delegate access keys for spouse, children, and parents.";
                break;
            case 'kyc-audit':
                pageTitle.innerText = "KYC Integrity Checker";
                pageSubtitle.innerText = "Cross-document machine analysis scanning for inconsistencies.";
                break;
            case 'life-events':
                pageTitle.innerText = "Life Event Document Mapping";
                pageSubtitle.innerText = "Track cascading document compliance roadmaps triggered by major life events.";
                break;
            case 'renewals':
                pageTitle.innerText = "Renewals & Expiries Calendar";
                pageSubtitle.innerText = "Set reminder timers, pay premiums, and close compliance renewal loops.";
                break;
            case 'comms-log':
                pageTitle.innerText = "Reminders Simulator Center";
                pageSubtitle.innerText = "Verify SMS and Email updates sent out by the automated alert engine.";
                break;
            case 'subscription':
                pageTitle.innerText = "SaaS Subscription Tier Plan";
                pageSubtitle.innerText = "Review document quotas, multi-member features, and premium configurations.";
                break;
            case 'settings':
                pageTitle.innerText = "Profile & Settings";
                pageSubtitle.innerText = "Manage your administrative details, alert funnel thresholds, subscription and security options.";
                break;
        }

        this.renderAll();
        window.scrollTo(0,0);
    }

    // --- ACTIVE USER PROFILE MANAGEMENT ---
    switchMember(memberId) {
        if (memberId === 'head') {
            this.activeMember = 'head';
            this.updateActiveUserUI();
            this.switchTab(this.activeTab);
            this.toast("Switched to your profile", "success");
            return;
        }

        // Check subscription paywall for other profiles
        if (this.billingTier === 'free') {
            // Trigger Paywall!
            this.toast("Access Locked. Upgrade to Family Pro to view family vaults.", "danger");
            this.switchTab('subscription');
            // Highlight the pro card
            const proCard = document.getElementById('pricing-card-pro');
            proCard.classList.add('premium-shake');
            setTimeout(() => proCard.classList.remove('premium-shake'), 800);
            return;
        }

        this.activeMember = memberId;
        this.updateActiveUserUI();
        this.switchTab(this.activeTab);
        this.toast(`Switched view to ${this.members[memberId].name}`, "success");
    }

    updateActiveUserUI() {
        const mem = this.members[this.activeMember];
        document.getElementById('active-user-avatar').src = mem.avatar;
        document.getElementById('active-user-name').innerText = mem.name;
        document.getElementById('active-user-role').innerText = this.activeMember === 'head' ? 'Head of Family' : mem.relation;
    }

    toggleProfileDropdown() {
        const dd = document.getElementById('profile-dropdown');
        dd.classList.toggle('hidden');
        if (!dd.classList.contains('hidden')) {
            this.renderProfileDropdown();
        }
    }

    renderProfileDropdown() {
        const list = document.getElementById('profile-dropdown-list');
        list.innerHTML = '';
        
        Object.keys(this.members).forEach(mId => {
            const mem = this.members[mId];
            const isActive = this.activeMember === mId;
            
            const item = document.createElement('div');
            item.className = `profile-dropdown-item ${isActive ? 'active' : ''}`;
            
            // Add a lock icon to non-head items if free tier
            const lockIcon = (mId !== 'head' && this.billingTier === 'free') 
                ? `<i data-lucide="lock" style="width: 14px; height: 14px; margin-left: auto; color: var(--text-muted);"></i>`
                : '';
                
            item.innerHTML = `
                <img src="${mem.avatar}" alt="${mem.name}">
                <div class="profile-dropdown-item-info">
                    <span class="name">${mem.name}</span>
                    <span class="relationship">${mId === 'head' ? 'Primary Admin' : mem.relation}</span>
                </div>
                ${lockIcon}
            `;
            
            item.onclick = (e) => {
                e.stopPropagation();
                document.getElementById('profile-dropdown').classList.add('hidden');
                this.switchMember(mId);
            };
            
            list.appendChild(item);
        });

        // Add Sign Out / Lock Vault Option at the bottom
        const signOut = document.createElement('div');
        signOut.className = 'profile-dropdown-item';
        signOut.style.borderTop = '1px solid var(--border-color)';
        signOut.style.marginTop = '6px';
        signOut.style.paddingTop = '12px';
        signOut.innerHTML = `
            <div class="channel-icon-col" style="background-color: var(--danger-bg); color: var(--danger); width: 28px; height: 28px; font-size: 14px; border-radius: 50%; margin-right: 12px; display: flex; align-items: center; justify-content: center;">
                <i data-lucide="log-out" style="width: 14px; height: 14px;"></i>
            </div>
            <div class="profile-dropdown-item-info">
                <span class="name" style="color: var(--danger); font-weight: 700;">Lock Secure Vault</span>
                <span class="relationship">End secure session</span>
            </div>
        `;
        signOut.onclick = (e) => {
            e.stopPropagation();
            document.getElementById('profile-dropdown').classList.add('hidden');
            this.handleSignOut();
        };
        list.appendChild(signOut);
        
        lucide.createIcons();
    }

    // --- UPLOAD DOCUMENT ACTIONS ---
    openUploadModal(docId = null) {
        const form = document.getElementById('doc-form');
        form.reset();
        this.uploadedFile = null;
        document.getElementById('file-attached-info').classList.add('hidden');
        document.getElementById('drag-drop-zone').classList.remove('hidden');

        if (docId) {
            // Edit Mode
            const doc = this.documents.find(d => d.id === docId);
            document.getElementById('modal-title').innerText = "Edit Document Metadata";
            document.getElementById('doc-id-field').value = doc.id;
            document.getElementById('doc-member-select').value = doc.owner;
            document.getElementById('doc-type-select').value = doc.type;
            document.getElementById('doc-num-input').value = doc.number;
            document.getElementById('doc-expiry-input').value = doc.expiryDate || '';
            document.getElementById('doc-kyc-name').value = doc.kycName;
            document.getElementById('doc-kyc-dob').value = doc.kycDob;
            document.getElementById('doc-kyc-address').value = doc.kycAddress;
            
            // Attached file representation
            if (doc.fileName) {
                this.uploadedFile = { name: doc.fileName };
                document.getElementById('attached-filename').innerText = doc.fileName;
                document.getElementById('file-attached-info').classList.remove('hidden');
                document.getElementById('drag-drop-zone').classList.add('hidden');
            }
        } else {
            // New upload mode
            document.getElementById('modal-title').innerText = "Upload New Document";
            document.getElementById('doc-id-field').value = '';
            
            // pre-populate default owner with active user
            document.getElementById('doc-member-select').value = this.activeMember;
            this.onDocTypeChange();
        }

        document.getElementById('doc-modal').classList.remove('hidden');
    }

    closeUploadModal() {
        document.getElementById('doc-modal').classList.add('hidden');
    }

    onDocTypeChange() {
        const type = document.getElementById('doc-type-select').value;
        const numInput = document.getElementById('doc-num-input');
        const expInput = document.getElementById('doc-expiry-input');
        
        // Auto customize placeholder guidelines
        switch(type) {
            case 'Aadhaar':
                numInput.placeholder = "12-digit Aadhaar e.g. 5421 8976 0912";
                expInput.disabled = true;
                expInput.value = '';
                break;
            case 'SSN Card':
                numInput.placeholder = "9-digit SSN e.g. XXX-XX-1234";
                expInput.disabled = true;
                expInput.value = '';
                break;
            case 'NINO Card':
                numInput.placeholder = "9-digit NINO e.g. QQ 12 34 56 A";
                expInput.disabled = true;
                expInput.value = '';
                break;
            case 'PAN':
            case 'State ID':
            case 'National ID':
                numInput.placeholder = "ID Number e.g. WXYZP5678Q";
                expInput.disabled = true;
                expInput.value = '';
                break;
            case 'Passport':
            case 'US Passport':
            case 'UK Passport':
                numInput.placeholder = "Passport No. e.g. Z1234567";
                expInput.disabled = false;
                break;
            case 'Driving License':
            case 'Driver\'s License':
                numInput.placeholder = "License Number e.g. DL-142010123456";
                expInput.disabled = false;
                break;
            default:
                numInput.placeholder = "Enter identifier number...";
                expInput.disabled = false;
        }

        // Pre-fill KYC values from anchor if owner is selected
        const owner = document.getElementById('doc-member-select').value;
        const anchorType = this.selectedCountry === 'US' ? 'SSN Card' : (this.selectedCountry === 'UK' ? 'NINO Card' : 'Aadhaar');
        const anchor = this.documents.find(d => d.owner === owner && d.type === anchorType);
        if (anchor) {
            document.getElementById('doc-kyc-name').value = anchor.kycName;
            document.getElementById('doc-kyc-dob').value = anchor.kycDob;
            document.getElementById('doc-kyc-address').value = anchor.kycAddress;
        }
    }

    handleFileSelected(file) {
        this.uploadedFile = file;
        document.getElementById('attached-filename').innerText = file.name;
        document.getElementById('file-attached-info').classList.remove('hidden');
        document.getElementById('drag-drop-zone').classList.add('hidden');
        this.toast(`Attached ${file.name}`, "info");
    }

    removeAttachedFile() {
        this.uploadedFile = null;
        document.getElementById('file-attached-info').classList.add('hidden');
        document.getElementById('drag-drop-zone').classList.remove('hidden');
    }

    saveDocument(event) {
        event.preventDefault();
        
        // Document Limit check for free tier (Limit: 5 documents)
        if (this.billingTier === 'free' && this.documents.length >= 5 && !document.getElementById('doc-id-field').value) {
            this.toast("Limit Reached: Upgrade to Family Pro to store more than 5 documents.", "danger");
            this.closeUploadModal();
            this.switchTab('subscription');
            return;
        }

        const id = document.getElementById('doc-id-field').value;
        const owner = document.getElementById('doc-member-select').value;
        const type = document.getElementById('doc-type-select').value;
        const number = this.sanitizeFinancialNumber(document.getElementById('doc-num-input').value, type);
        const expiryDate = document.getElementById('doc-expiry-input').value || null;
        const kycName = document.getElementById('doc-kyc-name').value;
        const kycDob = document.getElementById('doc-kyc-dob').value;
        const kycAddress = document.getElementById('doc-kyc-address').value;
        const fileName = this.uploadedFile ? this.uploadedFile.name : `${type.toLowerCase()}_attached.pdf`;

        if (id) {
            // Edit mode: find & update
            const doc = this.documents.find(d => d.id === id);
            doc.owner = owner;
            doc.type = type;
            doc.number = number;
            doc.expiryDate = expiryDate;
            doc.kycName = kycName;
            doc.kycDob = kycDob;
            doc.kycAddress = kycAddress;
            doc.fileName = fileName;
            doc.status = 'valid'; // reset status, rechecked below
            this.toast("Document metadata updated successfully.", "success");
            
            // Add timeline
            this.actionTimeline.unshift({
                time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                title: `${type} Updated`,
                desc: `Metadata fields for ${this.members[owner].name}'s ${type} updated by administrator.`,
                status: 'completed'
            });
        } else {
            // New upload mode: insert
            const newDoc = {
                id: `doc-${owner}-${Date.now()}`,
                owner,
                type,
                number,
                kycName,
                kycDob,
                kycAddress,
                fileName,
                expiryDate,
                status: 'valid'
            };
            this.documents.push(newDoc);
            this.toast(`Successfully uploaded and scanned ${type}.`, "success");
            
            // Add timeline
            this.actionTimeline.unshift({
                time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                title: `New ${type} Uploaded`,
                desc: `${this.members[owner].name}'s ${type} uploaded. Secure OCR metadata validation triggered.`,
                status: 'completed'
            });
        }

        this.closeUploadModal();
        this.runFullKYCScan();
        this.runExpiryCheck();
        this.renderAll();
    }

    deleteDocument(docId) {
        if (confirm("Are you sure you want to delete this document from the secure vault? This action cannot be undone.")) {
            const docIdx = this.documents.findIndex(d => d.id === docId);
            const doc = this.documents[docIdx];
            this.documents.splice(docIdx, 1);
            this.toast(`${doc.type} deleted.`, "info");
            
            this.actionTimeline.unshift({
                time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                title: `${doc.type} Removed`,
                desc: `${this.members[doc.owner].name}'s ${doc.type} permanently deleted from secure vault.`,
                status: 'completed'
            });

            this.runFullKYCScan();
            this.runExpiryCheck();
            this.renderAll();
            this.closeDetailModal();
        }
    }

    // --- DETAILED DOCUMENT INSPECTION DRAWER ---
    openDetailModal(docId) {
        const doc = this.documents.find(d => d.id === docId);
        const owner = this.members[doc.owner];
        
        // Format Expiry text
        const expiryText = doc.expiryDate ? this.formatDateStr(doc.expiryDate) : 'Permanent / Non-expiring';
        
        let statusBadge = '';
        if (doc.status === 'valid') {
            statusBadge = '<span class="status-badge-dot success"><i data-lucide="check-circle-2"></i> Valid / Safe</span>';
        } else if (doc.status === 'warning') {
            statusBadge = '<span class="status-badge-dot warning"><i data-lucide="alert-triangle"></i> KYC Conflict</span>';
        } else {
            statusBadge = '<span class="status-badge-dot danger"><i data-lucide="x-circle"></i> Renewal Required</span>';
        }

        const body = document.getElementById('detail-modal-body');
        body.innerHTML = `
            <div class="doc-inspector-grid">
                <!-- Preview mockup panel -->
                <div class="doc-inspector-preview">
                    <div class="doc-preview-glow"></div>
                    <i data-lucide="file-text" class="preview-logo"></i>
                    <h4 class="preview-doc-title">${doc.type} Card</h4>
                    <p class="preview-doc-sub">${doc.number}</p>
                    <span class="preview-chip">${doc.fileName}</span>
                    <p style="font-size: 10px; color: #64748b; margin-top: 24px;"><i data-lucide="lock" style="width: 10px; height:10px; display:inline;"></i> AES-256 Encrypted</p>
                </div>
                
                <!-- Details list -->
                <div class="doc-inspector-details">
                    <div class="inspector-meta-box">
                        <div class="inspector-meta-title">Vault Records</div>
                        <div class="inspector-meta-list">
                            <div class="inspector-meta-row">
                                <span class="label">Owner</span>
                                <span class="val" style="display:flex; align-items:center; gap:6px;">
                                    <img src="${owner.avatar}" style="width: 18px; height: 18px; border-radius:50%;">
                                    ${owner.name} (${owner.relation})
                                </span>
                            </div>
                            <div class="inspector-meta-row">
                                <span class="label">Document Status</span>
                                <span class="val">${statusBadge}</span>
                            </div>
                            <div class="inspector-meta-row">
                                <span class="label">Expiry Schedule</span>
                                <span class="val ${doc.expiryDate && new Date(doc.expiryDate) < new Date() ? 'text-danger text-bold' : ''}">${expiryText}</span>
                            </div>
                        </div>
                    </div>

                    <div class="inspector-meta-box">
                        <div class="inspector-meta-title">OCR Extracted KYC Metadata</div>
                        <div class="inspector-meta-list">
                            <div class="inspector-meta-row">
                                <span class="label">Full Name</span>
                                <span class="val">${doc.kycName}</span>
                            </div>
                            <div class="inspector-meta-row">
                                <span class="label">Date of Birth</span>
                                <span class="val">${this.formatDateStr(doc.kycDob)}</span>
                            </div>
                            <div class="inspector-meta-row">
                                <span class="label">Address</span>
                                <span class="val" style="text-align:right; max-width: 60%; font-size:11px;">${doc.kycAddress}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const footer = document.getElementById('detail-modal-footer');
        footer.innerHTML = `
            <button class="btn btn-outline" style="margin-right:auto; color:var(--danger);" onclick="app.deleteDocument('${doc.id}')">
                <i data-lucide="trash-2"></i> Delete
            </button>
            <button class="btn btn-outline" onclick="app.openUploadModal('${doc.id}')">
                <i data-lucide="edit"></i> Edit Fields
            </button>
            <button class="btn btn-primary" onclick="app.closeDetailModal()">Done</button>
        `;

        document.getElementById('detail-modal').classList.remove('hidden');
        lucide.createIcons();
    }

    closeDetailModal() {
        document.getElementById('detail-modal').classList.add('hidden');
    }

    // --- CLOSED LOOP KYC RESOLUTIONS ---
    openResolutionModal(warningId) {
        const warning = this.kycWarnings.find(w => w.id === warningId);
        const doc1 = this.documents.find(d => d.id === warning.doc1Id);
        const doc2 = this.documents.find(d => d.id === warning.doc2Id);
        
        const body = document.getElementById('renewal-modal-body');
        
        if (warning.field === 'Full Name') {
            body.innerHTML = `
                <div class="action-box">
                    <div class="action-icon-circle warning"><i data-lucide="user-check"></i></div>
                    <h3>Resolve Name Discrepancy</h3>
                    <p class="action-card-desc">We detected that the name in your <strong>${warning.docType}</strong> card does not match your primary identity card <strong>${warning.anchorDocType}</strong>.</p>
                    
                    <div class="verification-step-card mt-sm">
                        <div><span>Primary ID (${warning.anchorDocType}):</span> ${warning.value1}</div>
                        <div><span>Conflict ID (${warning.docType}):</span> ${warning.value2}</div>
                    </div>

                    <div class="form-group w-full text-left mt-md">
                        <label>How would you like to close this compliance loop?</label>
                        <button class="btn btn-accent w-full text-left mt-sm justify-start" onclick="app.actionResolveName('${warning.id}', '${doc2.id}', '${doc1.kycName}')">
                            <i data-lucide="sparkles"></i> Correct ${warning.docType} Name to "${doc1.kycName}"
                        </button>
                        <button class="btn btn-outline w-full text-left mt-sm justify-start" onclick="app.openUploadModal('${doc2.id}'); app.closeRenewalModal();">
                            <i data-lucide="upload"></i> Upload Corrected Scan
                        </button>
                        <button class="btn btn-outline w-full text-left mt-sm justify-start" style="color:var(--text-secondary);" onclick="app.actionDismissMismatch('${warning.id}')">
                            <i data-lucide="check"></i> Acknowledge spelling variation (Dismiss warning)
                        </button>
                    </div>
                </div>
            `;
        } else if (warning.field === 'Date of Birth') {
            body.innerHTML = `
                <div class="action-box">
                    <div class="action-icon-circle danger"><i data-lucide="calendar"></i></div>
                    <h3>Resolve DOB Discrepancy</h3>
                    <p class="action-card-desc">Critical conflict! The Date of Birth in <strong>${warning.docType}</strong> differs from <strong>${warning.anchorDocType}</strong>. DOB must be aligned for correct utility/bank connection.</p>
                    
                    <div class="verification-step-card mt-sm">
                        <div><span>Primary ID (${warning.anchorDocType}):</span> ${warning.value1}</div>
                        <div><span>Conflict ID (${warning.docType}):</span> ${warning.value2}</div>
                    </div>

                    <div class="form-group w-full text-left mt-md">
                        <label>Select Resolution Action:</label>
                        <button class="btn btn-accent w-full text-left mt-sm justify-start" onclick="app.actionResolveDob('${warning.id}', '${doc2.id}', '${doc1.kycDob}')">
                            <i data-lucide="check-square"></i> Change ${warning.docType} DOB to ${warning.value1}
                        </button>
                        <button class="btn btn-outline w-full text-left mt-sm justify-start" onclick="app.openUploadModal('${doc2.id}'); app.closeRenewalModal();">
                            <i data-lucide="upload"></i> Upload Corrected ID Card
                        </button>
                        <button class="btn btn-outline w-full text-left mt-sm justify-start" onclick="app.actionDismissMismatch('${warning.id}')">
                            <i data-lucide="x"></i> Acknowledge & Ignore
                        </button>
                    </div>
                </div>
            `;
        } else if (warning.field === 'Residential Address') {
            body.innerHTML = `
                <div class="action-box">
                    <div class="action-icon-circle warning"><i data-lucide="map-pin"></i></div>
                    <h3>Resolve Address Inconsistency</h3>
                    <p class="action-card-desc">Address fields differ significantly. Verify if this is an old residency record that needs updating.</p>
                    
                    <div class="verification-step-card mt-sm text-xs">
                        <div><span>Primary (${warning.anchorDocType}):</span> ${warning.value1}</div>
                        <div class="mt-sm"><span>Discrepancy (${warning.docType}):</span> ${warning.value2}</div>
                    </div>

                    <div class="form-group w-full text-left mt-md">
                        <label>Select Resolution Action:</label>
                        <button class="btn btn-accent w-full text-left mt-sm justify-start" onclick="app.actionResolveAddress('${warning.id}', '${doc2.id}', '${doc1.kycAddress}')">
                            <i data-lucide="copy"></i> Sync ${warning.docType} Address to Primary
                        </button>
                        <button class="btn btn-outline w-full text-left mt-sm justify-start" onclick="app.actionDismissMismatch('${warning.id}')">
                            <i data-lucide="eye-off"></i> Ignore / Multi-residence Address is Valid
                        </button>
                    </div>
                </div>
            `;
        }

        document.getElementById('renewal-modal').classList.remove('hidden');
        lucide.createIcons();
    }

    actionResolveName(warningId, docId, targetName) {
        const doc = this.documents.find(d => d.id === docId);
        const oldName = doc.kycName;
        doc.kycName = targetName;
        doc.status = 'valid';
        
        this.actionTimeline.unshift({
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            title: 'KYC Mismatch Resolved',
            desc: `Spelling conflict resolved on ${this.members[doc.owner].name}'s ${doc.type}. Corrected name from "${oldName}" to "${targetName}".`,
            status: 'completed'
        });

        // Trigger SMS/Email simulation notifying the resolution!
        this.addResolutionCommsAlert(doc.owner, doc.type, 'KYC Name Correction');

        this.toast("KYC Conflict resolved successfully.", "success");
        this.closeRenewalModal();
        this.runFullKYCScan();
        this.renderAll();
    }

    actionResolveDob(warningId, docId, targetDob) {
        const doc = this.documents.find(d => d.id === docId);
        const oldDob = doc.kycDob;
        doc.kycDob = targetDob;
        doc.status = 'valid';
        
        this.actionTimeline.unshift({
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            title: 'DOB KYC Resolved',
            desc: `Date of Birth discrepancy resolved on ${this.members[doc.owner].name}'s ${doc.type}. Aligned to primary profile.`,
            status: 'completed'
        });

        this.addResolutionCommsAlert(doc.owner, doc.type, 'Date of Birth Verification');

        this.toast("Date of birth conflict resolved.", "success");
        this.closeRenewalModal();
        this.runFullKYCScan();
        this.renderAll();
    }

    actionResolveAddress(warningId, docId, targetAddress) {
        const doc = this.documents.find(d => d.id === docId);
        doc.kycAddress = targetAddress;
        doc.status = 'valid';
        
        this.actionTimeline.unshift({
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            title: 'Address Sync Completed',
            desc: `Synchronized official address of ${doc.type} for ${this.members[doc.owner].name} to Dwarka apartments.`,
            status: 'completed'
        });

        this.addResolutionCommsAlert(doc.owner, doc.type, 'Address Verification');

        this.toast("Address conflict resolved.", "success");
        this.closeRenewalModal();
        this.runFullKYCScan();
        this.renderAll();
    }

    actionDismissMismatch(warningId) {
        const warningIdx = this.kycWarnings.findIndex(w => w.id === warningId);
        const warning = this.kycWarnings[warningIdx];
        
        // Remove from current warning list and timeline it
        this.kycWarnings.splice(warningIdx, 1);
        
        // Force document status update if no more warning matches
        const doc2 = this.documents.find(d => d.id === warning.doc2Id);
        doc2.status = 'valid';
        
        this.actionTimeline.unshift({
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            title: 'KYC Alert Dismissed',
            desc: `Warning regarding name mismatch on ${this.members[warning.memberId].name}'s ${warning.docType} was manually acknowledged and dismissed.`,
            status: 'completed'
        });

        this.toast("Alert marked as Acknowledged. Loop closed.", "info");
        this.closeRenewalModal();
        this.runFullKYCScan();
        this.renderAll();
    }

    closeRenewalModal() {
        document.getElementById('renewal-modal').classList.add('hidden');
    }

    // --- CLOSED LOOP EXPIRY RENEWALS ---
    openRenewalActionModal(alertId) {
        const alert = this.expiryAlerts.find(a => a.id === alertId);
        const doc = this.documents.find(d => d.id === alert.docId);
        
        const body = document.getElementById('renewal-modal-body');
        body.innerHTML = `
            <div class="action-box">
                <div class="action-icon-circle danger"><i data-lucide="clock"></i></div>
                <h3>Process Document Renewal</h3>
                <p class="action-card-desc">The secure sentinel flagged that <strong>${alert.docType}</strong> (${alert.docNum}) is expiring. To close this loop, complete the renewal process and pay any applicable government/insurance fees.</p>
                
                <div class="verification-step-card mt-sm">
                    <div><span>Current Expiry:</span> ${this.formatDateStr(alert.expiryDate)}</div>
                    <div><span>Days Remaining:</span> ${alert.daysRemaining} days</div>
                </div>

                <div class="form-group w-full text-left mt-md">
                    <label>Select Renewal Workflow:</label>
                    <button class="btn btn-accent w-full text-left mt-sm justify-start" onclick="app.actionCompleteRenewal('${alert.id}')">
                        <i data-lucide="credit-card"></i> Pay Premium / Auto-Apply Renewal (₹15,420)
                    </button>
                    <button class="btn btn-outline w-full text-left mt-sm justify-start" onclick="app.openUploadModal('${doc.id}'); app.closeRenewalModal();">
                        <i data-lucide="upload"></i> Upload Renewed Scan Receipt
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('renewal-modal').classList.remove('hidden');
        lucide.createIcons();
    }

    actionCompleteRenewal(alertId) {
        const alert = this.expiryAlerts.find(a => a.id === alertId);
        const doc = this.documents.find(d => d.id === alert.docId);
        
        // Update document expiry date (extends by 5 years or shifts forward)
        const oldExpiry = doc.expiryDate;
        const newExpDate = new Date("2031-07-26"); // Set 5 years in future from current simulated date
        doc.expiryDate = newExpDate.toISOString().substring(0,10);
        doc.status = 'valid';
        
        this.actionTimeline.unshift({
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            title: `${doc.type} Renewed`,
            desc: `Closed-loop renewal finalized for ${this.members[doc.owner].name}'s ${doc.type}. Expiry extended from ${this.formatDateStr(oldExpiry)} to ${this.formatDateStr(doc.expiryDate)}.`,
            status: 'completed'
        });

        // Add a simulator comm log entry for renewal confirmation!
        this.addRenewalConfirmationComms(doc.owner, doc.type);

        this.toast(`Renewal transaction completed. ${doc.type} extended.`, "success");
        this.closeRenewalModal();
        this.runExpiryCheck();
        this.renderAll();
    }

    // --- COMMUNICATION SIMULATOR LOG UTILS ---
    addResolutionCommsAlert(ownerId, docType, actionName) {
        const owner = this.members[ownerId];
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        
        // Send simulated SMS confirm
        this.commsLog.unshift({
            id: Date.now(),
            channel: 'sms',
            recipient: `${owner.name} (+91 98765 43210)`,
            subject: 'Family KYC Manager Alert Acknowledged',
            body: `CONFIRMED: Your ${docType} ${actionName} discrepancy has been resolved by Head of Family. Document flagged safe in vault. Loop closed.`,
            timestamp
        });

        // Send simulated Email confirm
        this.commsLog.unshift({
            id: Date.now() + 1,
            channel: 'email',
            recipient: ownerId === 'head' ? 'vikram.garg@gmail.com' : 'family.member@familykyc.com',
            subject: `[Resolved] KYC Loop Closed for ${docType}`,
            body: `Dear Family Account Holder,\n\nThis is to notify you that the database mismatch warning on your ${docType} has been successfully audited and resolved by the Head of Family on ${timestamp}.\n\nNo further actions are required from your side.\n\nThank you for choosing Family KYC Manager.`,
            timestamp
        });
    }

    addRenewalConfirmationComms(ownerId, docType) {
        const owner = this.members[ownerId];
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        
        this.commsLog.unshift({
            id: Date.now(),
            channel: 'sms',
            recipient: `${owner.name} (+91 98765 43210)`,
            subject: 'Renewal Finalized',
            body: `SUCCESS: Your ${docType} renewal fee transaction has been processed. Extended expiry date updated in Family KYC Manager database. Loop closed.`,
            timestamp
        });
    }

    filterComms(channel) {
        document.querySelectorAll('.filter-chip').forEach(c => {
            if (c.getAttribute('data-channel') === channel) {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });
        
        this.renderCommsLogList(channel);
    }

    clearCommsLog() {
        this.commsLog = [];
        this.renderCommsLogList();
        this.toast("Simulated alert logs cleared.", "info");
    }

    getLocalizedPriceString(country, billingCycle) {
        if (country === 'US') {
            return billingCycle === 'yearly'
                ? '<span class="currency">$</span>29.99<span class="period">/ year ($2.49/mo)</span>'
                : '<span class="currency">$</span>2.99<span class="period">/ month</span>';
        } else if (country === 'UK') {
            return billingCycle === 'yearly'
                ? '<span class="currency">£</span>24.99<span class="period">/ year (£2.08/mo)</span>'
                : '<span class="currency">£</span>2.49<span class="period">/ month</span>';
        } else {
            return billingCycle === 'yearly'
                ? '<span class="currency">₹</span>2,868<span class="period">/ year (₹239/mo)</span>'
                : '<span class="currency">₹</span>299<span class="period">/ month</span>';
        }
    }

    // --- SAAS BILLING ACTIONS ---
    toggleBillingCycle() {
        const checked = document.getElementById('billing-toggle').checked;
        this.billingCycle = checked ? 'yearly' : 'monthly';
        
        const priceVal = document.getElementById('pro-price-val');
        if (priceVal) {
            priceVal.innerHTML = this.getLocalizedPriceString(this.selectedCountry, this.billingCycle);
        }
        
        this.toast(`Switched prices to ${this.billingCycle} billing cycle.`, "info");
    }

    upgradeSubscription() {
        const priceLabel = document.getElementById('payment-modal-price');
        if (priceLabel) {
            const priceStr = this.getLocalizedPriceString(this.selectedCountry, this.billingCycle);
            priceLabel.innerHTML = priceStr;
        }
        
        document.getElementById('payment-modal').classList.remove('hidden');
    }

    closePaymentModal() {
        document.getElementById('payment-modal').classList.add('hidden');
    }

    processPaymentSubmit() {
        const payBtn = document.getElementById('btn-pay-submit');
        if (payBtn) {
            payBtn.disabled = true;
            payBtn.innerHTML = '<span class="loading-spinner" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; width: 12px; height: 12px; display: inline-block; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: middle;"></span> Processing Gateway...';
        }
        
        setTimeout(() => {
            if (payBtn) {
                payBtn.disabled = false;
                payBtn.innerText = "Pay & Activate Plan";
            }
            this.closePaymentModal();
            this.billingTier = 'pro';
            
            // Add upgraded status timeline
            this.actionTimeline.unshift({
                time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                title: 'Upgraded to Family Pro',
                desc: 'Subscribed to Family Pro FamilyKYCManager Plan. Multi-member vaults unlocked.',
                status: 'completed'
            });

            const priceText = this.selectedCountry === 'US' 
                ? (this.billingCycle === 'yearly' ? '$29.99' : '$2.99')
                : (this.selectedCountry === 'UK' 
                    ? (this.billingCycle === 'yearly' ? '£24.99' : '£2.49')
                    : (this.billingCycle === 'yearly' ? '₹2,868' : '₹299'));

            const headEmail = this.members['head'].email || 'vikram.garg@gmail.com';
            const headMobile = this.members['head'].mobile || '+91 98765 43210';

            // Send Confirmation Email
            this.commsLog.unshift({
                id: Date.now(),
                channel: 'email',
                recipient: headEmail,
                subject: 'Payment Confirmation - FamilyKYCManager Subscription Active',
                body: `Dear ${this.members['head'].name},\n\nYour payment of ${priceText} was successfully processed via Razorpay Secure Gateway.\n\nYour FamilyKYCManager Subscription is now ACTIVE.\n\nReceipt Details:\n- Payment Channel: Credit Card\n- Plan: Family Pro FamilyKYCManager (${this.billingCycle} billing)\n- Amount: ${priceText}\n- Account Level: Family Admin\n\nThank you for securing your household's administrative records!\n\nBest Regards,\nFamilyKYCManager Support`,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
            });

            // Send Confirmation SMS
            this.commsLog.unshift({
                id: Date.now() + 1,
                channel: 'sms',
                recipient: headMobile,
                subject: 'FamilyKYCManager Payment Activated',
                body: `ALERT: Payment of ${priceText} completed successfully. Family Pro FamilyKYCManager features unlocked for user ${this.members['head'].name}. Check email invoices at ${headEmail}.`,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
            });

            this.toast("CONGRATULATIONS! Payment processed and upgraded to Family Pro.", "success");
            this.toast(`Sent payment confirmation email to ${headEmail} and SMS to ${headMobile}.`, "info");
            
            // Sync preferences plan status field
            const planTierEl = document.getElementById('settings-plan-tier');
            if (planTierEl) {
                planTierEl.innerText = 'FamilyKYCManager Plan';
            }

            this.switchTab('dashboard');
        }, 1500);
    }

    // --- GENERAL RENDERING & UI UPDATES ---
    renderAll() {
        this.calculateLifeEvents();
        this.updateTierWidgetUI();
        this.renderNotificationsList();
        
        // Select what tab to draw
        switch(this.activeTab) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'documents':
                this.renderDocumentsVault();
                break;
            case 'family':
                this.renderFamilyVaultPanel();
                break;
            case 'kyc-audit':
                this.renderKYCAudit();
                break;
            case 'life-events':
                this.renderLifeEvents();
                break;
            case 'renewals':
                this.renderRenewalsPanel();
                break;
            case 'comms-log':
                this.renderCommsLogList();
                break;
            case 'settings':
                this.renderSettings();
                break;
        }

        lucide.createIcons();
    }

    updateTierWidgetUI() {
        const sidebarTierName = document.getElementById('sidebar-tier-name');
        const sidebarTierLimit = document.getElementById('sidebar-tier-limit');
        const sidebarProgressBar = document.getElementById('sidebar-progress-bar');
        const sidebarTierMsg = document.getElementById('sidebar-tier-msg');
        
        // Head of family documents count vs other members
        const countSelf = this.documents.filter(d => d.owner === 'head').length;
        const totalCount = this.documents.length;
        
        const bannerFree = document.getElementById('topbar-upgrade-banner');
        const bannerPro = document.getElementById('topbar-pro-banner');

        if (this.billingTier === 'free') {
            sidebarTierName.innerText = "Free Tier";
            sidebarTierName.className = "tier-label text-warning";
            sidebarTierLimit.innerText = `${countSelf} / 5 docs`;
            const pct = Math.min(100, Math.round((countSelf / 5) * 100));
            sidebarProgressBar.style.width = `${pct}%`;
            sidebarProgressBar.style.backgroundColor = "var(--warning)";
            sidebarTierMsg.innerText = "1 User Only. Upgrade for Family access.";
            
            bannerFree.classList.remove('hidden');
            bannerPro.classList.add('hidden');
            
            document.querySelectorAll('.free-only').forEach(el => el.classList.remove('hidden'));
            document.querySelectorAll('.pro-only').forEach(el => el.classList.add('hidden'));
            
            document.getElementById('stat-free-cap').innerText = "Free tier (max 5 docs)";
        } else {
            // Pro Tier
            sidebarTierName.innerText = "Family Pro Vault";
            sidebarTierName.className = "tier-label text-success";
            sidebarTierLimit.innerText = `${totalCount} docs stored`;
            sidebarProgressBar.style.width = `100%`;
            sidebarProgressBar.style.background = "linear-gradient(90deg, #d97706 0%, #fbbf24 100%)";
            sidebarTierMsg.innerText = "Unlimited Storage. Family Active.";
            
            bannerFree.classList.add('hidden');
            bannerPro.classList.remove('hidden');
            
            document.querySelectorAll('.free-only').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.pro-only').forEach(el => el.classList.remove('hidden'));
            
            document.getElementById('stat-free-cap').innerText = "Pro account (Unlimited docs)";
        }
    }

    renderNotificationsList() {
        const notifBellBtn = document.getElementById('notif-bell-btn');
        const notifList = document.getElementById('notif-dropdown-list');
        const bellDot = document.getElementById('bell-dot');
        
        notifList.innerHTML = '';
        const unreadCount = this.notifications.filter(n => !n.read).length;
        
        if (unreadCount > 0) {
            bellDot.classList.remove('hidden');
        } else {
            bellDot.classList.add('hidden');
        }
        
        if (this.notifications.length === 0) {
            notifList.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px;">No notifications.</div>';
            return;
        }

        this.notifications.forEach(notif => {
            const item = document.createElement('div');
            item.className = `notif-item ${notif.read ? '' : 'unread'}`;
            
            let icon = 'info';
            if (notif.type === 'danger') icon = 'alert-octagon';
            if (notif.type === 'warning') icon = 'alert-triangle';

            item.innerHTML = `
                <div class="notif-icon-wrapper ${notif.type}">
                    <i data-lucide="${icon}"></i>
                </div>
                <div class="notif-content">
                    <p>${notif.message}</p>
                    <span class="time">${notif.time}</span>
                </div>
            `;
            
            item.onclick = () => {
                notif.read = true;
                this.toast("Marked notification read", "info");
                this.renderAll();
                
                // Redirect depending on warning type
                if (notif.type === 'danger') {
                    this.switchTab('renewals');
                } else {
                    this.switchTab('kyc-audit');
                }
            };

            notifList.appendChild(item);
        });
    }

    toggleNotifDropdown() {
        document.getElementById('notif-dropdown').classList.toggle('hidden');
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) {
            const isOpen = sidebar.classList.contains('mobile-open');
            if (isOpen) {
                sidebar.classList.remove('mobile-open');
                if (backdrop) backdrop.classList.add('hidden');
            } else {
                sidebar.classList.add('mobile-open');
                if (backdrop) backdrop.classList.remove('hidden');
            }
        }
    }

    markAllNotificationsRead() {
        this.notifications.forEach(n => n.read = true);
        this.toast("All notifications marked as read.", "success");
        this.renderAll();
    }

    // --- VIEW COMPONENT GENERATORS ---
    renderDashboard() {
        // Total count
        const count = this.billingTier === 'free' 
            ? this.documents.filter(d => d.owner === 'head').length 
            : this.documents.length;
            
        document.getElementById('stat-total-docs').innerText = count;

        // Populate Alerts Banner
        const alertsList = document.getElementById('dashboard-alerts-list');
        alertsList.innerHTML = '';
        
        const allIssues = [];
        
        // Add Expiries first (critical)
        this.expiryAlerts.forEach(al => {
            allIssues.push({
                type: 'expiry',
                id: al.id,
                severity: al.priority === 'danger' ? 'danger' : 'warning',
                title: al.message,
                desc: `${al.ownerName}'s official document ID ${al.docNum}. Pay/Renew to complete loop.`,
                meta: `Expires: ${this.formatDateStr(al.expiryDate)}`
            });
        });
        
        // Add KYC warnings next
        // If Free Tier, show message that KYC warning list requires PRO upgrade
        if (this.billingTier === 'pro') {
            this.kycWarnings.forEach(wr => {
                allIssues.push({
                    type: 'kyc',
                    id: wr.id,
                    severity: wr.severity,
                    title: `KYC Inconsistency: Mismatched ${wr.field}`,
                    desc: wr.desc,
                    meta: `Owner: ${wr.memberName}`
                });
            });
        }
        
        if (allIssues.length === 0) {
            alertsList.innerHTML = `
                <div class="empty-state" style="padding: 24px; border-style:dashed;">
                    <i data-lucide="check-circle" class="text-success" style="width:24px; height:24px; margin-bottom:8px;"></i>
                    <h4 style="font-size:14px; font-weight:700;">No Urgent Issues Found</h4>
                    <p style="font-size:11px;">Your vault compliance and expiry sentinel details are fully healthy.</p>
                </div>
            `;
        } else {
            allIssues.forEach(iss => {
                const row = document.createElement('div');
                row.className = `alert-banner alert-${iss.severity}`;
                
                const icon = iss.severity === 'danger' ? 'shield-alert' : 'alert-triangle';
                
                // Action buttons logic
                let actionBtn = '';
                if (iss.type === 'expiry') {
                    actionBtn = `<button class="btn btn-danger btn-xs" onclick="app.openRenewalActionModal('${iss.id}')"><i data-lucide="refresh-cw"></i> Renew</button>`;
                } else {
                    actionBtn = `<button class="btn btn-warning btn-xs" onclick="app.openResolutionModal('${iss.id}')"><i data-lucide="wrench"></i> Resolve</button>`;
                }

                row.innerHTML = `
                    <div class="alert-icon-col">
                        <i data-lucide="${icon}"></i>
                    </div>
                    <div class="alert-content-col">
                        <h4 class="alert-title">${iss.title}</h4>
                        <p class="alert-desc">${iss.desc}</p>
                        <div class="alert-meta">
                            <span>${iss.meta}</span>
                        </div>
                    </div>
                    <div class="alert-actions-col">
                        ${actionBtn}
                    </div>
                `;
                alertsList.appendChild(row);
            });
        }

        // Render Family Compliance Grid
        const familyGrid = document.getElementById('family-compliance-grid');
        familyGrid.innerHTML = '';

        Object.keys(this.members).forEach(mId => {
            const mem = this.members[mId];
            const isHead = mId === 'head';
            
            // Get issues for member
            const memberDocs = this.documents.filter(d => d.owner === mId);
            const kycIssues = this.kycWarnings.filter(w => w.memberId === mId).length;
            const expIssues = this.expiryAlerts.filter(a => a.owner === mId).length;
            
            let status = 'success';
            let pillText = 'Safe';
            
            if (expIssues > 0) {
                status = 'danger';
                pillText = `${expIssues} Renewal Required`;
            } else if (kycIssues > 0 && this.billingTier === 'pro') {
                status = 'warning';
                pillText = `${kycIssues} KYC Mismatch`;
            }

            const card = document.createElement('div');
            card.className = `family-compliance-card ${status}`;
            
            // Lock overlay for free tier on other users
            const lockOverlay = (!isHead && this.billingTier === 'free')
                ? `<div class="lock-overlay">
                    <i data-lucide="lock" class="icon-danger"></i>
                    <span>Locked</span>
                   </div>`
                : '';

            card.innerHTML = `
                ${lockOverlay}
                <img src="${mem.avatar}" alt="${mem.name}" class="family-avatar-large">
                <span class="family-name">${mem.name}</span>
                <span class="family-relation">${isHead ? 'Primary Admin' : mem.relation}</span>
                <span class="compliance-status-pill ${status}">${pillText}</span>
                <div class="family-doc-summary">
                    <strong>${memberDocs.length}</strong> Document${memberDocs.length !== 1 ? 's' : ''} stored
                </div>
            `;
            
            card.onclick = () => {
                this.switchMember(mId);
            };
            
            familyGrid.appendChild(card);
        });

        // Document Breakdown List
        const categoryList = document.getElementById('dashboard-category-list');
        categoryList.innerHTML = '';
        
        // count per category
        const categories = {
            'Government ID': this.documents.filter(d => ['Aadhaar', 'PAN', 'Passport', 'Driving License', 'Voter ID'].includes(d.type)).length,
            'Financial / Tax': this.documents.filter(d => ['ITR'].includes(d.type)).length,
            'Insurance Policies': this.documents.filter(d => ['Insurance'].includes(d.type)).length,
            'Utility & Bills': this.documents.filter(d => d.type.startsWith('Utility') || d.type === 'Property Tax').length,
            'Education Records': this.documents.filter(d => ['Class 10 Certificate', 'Graduation Degree'].includes(d.type)).length,
            'Employment & Job': this.documents.filter(d => ['EPF UAN Card', 'W-2 Form', 'P60 Form'].includes(d.type)).length
        };
        
        const total = Object.values(categories).reduce((a,b) => a+b, 0);

        Object.keys(categories).forEach(cat => {
            const count = categories[cat];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            
            const item = document.createElement('div');
            item.className = "category-item";
            item.innerHTML = `
                <div class="category-item-header">
                    <span>${cat}</span>
                    <span>${count} (${pct}%)</span>
                </div>
                <div class="category-meter-container">
                    <div class="category-meter" style="width: ${pct}%;"></div>
                </div>
            `;
            categoryList.appendChild(item);
        });
    }

    renderDocumentsVault() {
        const grid = document.getElementById('documents-grid');
        grid.innerHTML = '';
        
        const query = document.getElementById('doc-search-input').value.toLowerCase();
        const memberFilter = document.getElementById('filter-member').value;
        const typeFilter = document.getElementById('filter-type').value;
        const statusFilter = document.getElementById('filter-status').value;
        
        let filtered = this.documents;
        
        // Filter based on user profile capability.
        // Free tier: ONLY Vikram (head) can see his own documents.
        if (this.activeMember !== 'head') {
            // Restricted user access level authorization: only see own files
            filtered = filtered.filter(d => d.owner === this.activeMember);
            const memberFilterContainer = document.getElementById('filter-member');
            if (memberFilterContainer) memberFilterContainer.style.display = 'none';
        } else {
            const memberFilterContainer = document.getElementById('filter-member');
            if (memberFilterContainer) memberFilterContainer.style.display = 'block';
            
            if (this.billingTier === 'free') {
                filtered = filtered.filter(d => d.owner === 'head');
            } else {
                if (memberFilter !== 'all') {
                    filtered = filtered.filter(d => d.owner === memberFilter);
                }
            }
        }

        // Apply drop down toolbar filters
        if (typeFilter !== 'all') {
            if (typeFilter === 'Utility') {
                filtered = filtered.filter(d => d.type.startsWith('Utility') || d.type === 'Property Tax');
            } else {
                filtered = filtered.filter(d => d.type === typeFilter);
            }
        }
        
        if (statusFilter !== 'all') {
            filtered = filtered.filter(d => d.status === statusFilter);
        }
        
        if (query) {
            filtered = filtered.filter(d => 
                d.type.toLowerCase().includes(query) || 
                d.number.toLowerCase().includes(query) || 
                d.kycName.toLowerCase().includes(query) ||
                d.fileName.toLowerCase().includes(query)
            );
        }
        
        const emptyState = document.getElementById('documents-empty-state');
        if (filtered.length === 0) {
            grid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        grid.classList.remove('hidden');
        emptyState.classList.add('hidden');

        filtered.forEach(doc => {
            const owner = this.members[doc.owner];
            
            const card = document.createElement('div');
            // Add custom classification classes
            let classType = 'Utility';
            if (['Aadhaar','PAN','Passport','Driving License','Voter ID'].includes(doc.type)) classType = doc.type;
            if (doc.type === 'ITR') classType = 'ITR';
            if (doc.type === 'Insurance') classType = 'Insurance';
            if (doc.type === 'Property Tax') classType = 'Property';
            if (doc.type === 'Class 10 Certificate') classType = 'Class10';
            if (doc.type === 'Graduation Degree') classType = 'Degree';
            if (doc.type === 'Employment Offer Letter') classType = 'Offer';
            if (doc.type === 'Salary Slip') classType = 'Salary';
            if (doc.type === 'EPF UAN Card') classType = 'UAN';

            card.className = `doc-card ${classType}`;
            
            // Format icon
            let icon = 'file-text';
            if (doc.type === 'Aadhaar') icon = 'fingerprint';
            if (doc.type === 'PAN') icon = 'credit-card';
            if (doc.type === 'Passport') icon = 'globe';
            if (doc.type === 'Driving License') icon = 'car';
            if (doc.type === 'Voter ID') icon = 'user';
            if (doc.type === 'ITR') icon = 'receipt';
            if (doc.type === 'Insurance') icon = 'heart-handshake';
            if (doc.type === 'Property Tax') icon = 'home';
            if (doc.type.startsWith('Utility')) icon = 'droplet';
            if (doc.type === 'Class 10 Certificate') icon = 'graduation-cap';
            if (doc.type === 'Graduation Degree') icon = 'award';
            if (doc.type === 'Employment Offer Letter') icon = 'briefcase';
            if (doc.type === 'Salary Slip') icon = 'wallet';
            if (doc.type === 'EPF UAN Card') icon = 'shield';

            let statusLabel = '';
            if (doc.status === 'valid') {
                statusLabel = '<span class="status-badge-dot success">Safe</span>';
            } else if (doc.status === 'warning') {
                statusLabel = '<span class="status-badge-dot warning">KYC Error</span>';
            } else {
                statusLabel = '<span class="status-badge-dot danger">Renew</span>';
            }

            const expiryStr = doc.expiryDate ? this.formatDateStr(doc.expiryDate) : 'Permanent';

            card.innerHTML = `
                <div class="doc-card-body">
                    <div class="doc-card-header">
                        <div class="doc-icon-badge">
                            <i data-lucide="${icon}"></i>
                        </div>
                        ${statusLabel}
                    </div>
                    <h3 class="doc-name-label">${doc.type}</h3>
                    <p class="text-xs text-muted" style="font-family:monospace; margin-bottom:12px;">ID: ${doc.number}</p>
                    
                    <div class="doc-metadata-brief">
                        <div class="meta-row">
                            <span class="label">Name:</span>
                            <span class="val">${doc.kycName}</span>
                        </div>
                        <div class="meta-row">
                            <span class="label">Expiry:</span>
                            <span class="val">${expiryStr}</span>
                        </div>
                    </div>
                </div>
                <div class="doc-card-footer">
                    <div class="doc-owner-badge">
                        <img src="${owner.avatar}" alt="" class="doc-owner-avatar">
                        <span class="doc-owner-name">${owner.name}</span>
                    </div>
                    <i data-lucide="chevron-right" style="width:16px; height:16px; color:var(--text-muted);"></i>
                </div>
            `;
            
            card.onclick = () => this.openDetailModal(doc.id);
            grid.appendChild(card);
        });
    }

    filterDocuments() {
        this.renderDocumentsVault();
        lucide.createIcons();
    }

    updateMemberSelectOptions() {
        const uploadSelect = document.getElementById('doc-member-select');
        if (uploadSelect) {
            uploadSelect.innerHTML = '';
            Object.keys(this.members).forEach(mId => {
                const mem = this.members[mId];
                const opt = document.createElement('option');
                opt.value = mId;
                opt.innerText = `${mem.name} (${mId === 'head' ? 'Self' : mem.relation})`;
                uploadSelect.appendChild(opt);
            });
        }

        const filterSelect = document.getElementById('filter-member');
        if (filterSelect) {
            const currentVal = filterSelect.value || 'all';
            filterSelect.innerHTML = '<option value="all">All Family Members</option>';
            Object.keys(this.members).forEach(mId => {
                const mem = this.members[mId];
                const opt = document.createElement('option');
                opt.value = mId;
                opt.innerText = `${mem.name} (${mId === 'head' ? 'Self' : mem.relation})`;
                filterSelect.appendChild(opt);
            });
            filterSelect.value = currentVal;
        }
    }

    showAddMemberModal() {
        const membersCount = Object.keys(this.members).length;
        if (membersCount >= 5) {
            this.toast("Maximum family capacity reached (5 members).", "warning");
            return;
        }
        
        // Reset default selected avatar state and styles
        this.selectedMemberAvatar = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100';
        document.querySelectorAll('.avatar-select-btn').forEach((btn, index) => {
            if (index === 0) {
                btn.classList.add('active');
                btn.style.borderColor = 'var(--accent)';
            } else {
                btn.classList.remove('active');
                btn.style.borderColor = 'transparent';
            }
        });
        
        document.getElementById('add-member-modal').classList.remove('hidden');
    }

    closeAddMemberModal() {
        document.getElementById('add-member-modal').classList.add('hidden');
        document.getElementById('add-member-form').reset();
    }

    selectPresetAvatar(clickedImg, avatarUrl) {
        this.selectedMemberAvatar = avatarUrl;
        
        document.querySelectorAll('.avatar-select-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.borderColor = 'transparent';
        });
        clickedImg.classList.add('active');
        clickedImg.style.borderColor = 'var(--accent)';
        
        // Clear custom input field when preset clicked
        const customInput = document.getElementById('new-member-avatar-url');
        if (customInput) customInput.value = '';
    }

    customAvatarUrlInput(url) {
        if (!url || !url.trim()) return;
        this.selectedMemberAvatar = url.trim();
        
        // Clear active styles from presets
        document.querySelectorAll('.avatar-select-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.borderColor = 'transparent';
        });
    }

    handleAddMember(event) {
        event.preventDefault();
        const name = document.getElementById('new-member-name').value;
        const role = document.getElementById('new-member-role').value;
        const relation = document.getElementById('new-member-relationship').value;
        
        if (!name || !relation) {
            this.toast("Please fill in all family member details.", "warning");
            return;
        }

        const mId = 'member-' + Date.now();
        const avatar = this.selectedMemberAvatar;

        this.members[mId] = {
            name: name,
            relation: relation,
            avatar: avatar,
            role: role === 'spouse' ? 'Spouse' : (role === 'child' ? 'Child' : 'Parent')
        };

        this.updateMemberSelectOptions();
        this.toast(`Added ${name} to Family directory successfully!`, "success");
        this.closeAddMemberModal();
        this.renderFamilyVaultPanel();
        this.renderAll();
    }

    renderFamilyVaultPanel() {
        const paywallBanner = document.getElementById('family-paywall');
        if (this.billingTier === 'free') {
            if (paywallBanner) paywallBanner.classList.remove('hidden');
        } else {
            if (paywallBanner) paywallBanner.classList.add('hidden');
        }

        // Render family setup cards
        const container = document.getElementById('family-members-setup-grid');
        container.innerHTML = '';

        Object.keys(this.members).forEach(mId => {
            const mem = this.members[mId];
            const isHead = mId === 'head';
            
            const docsCount = this.documents.filter(d => d.owner === mId).length;
            const warnings = this.kycWarnings.filter(w => w.memberId === mId).length;
            const expCount = this.expiryAlerts.filter(a => a.owner === mId).length;

            const card = document.createElement('div');
            card.className = "member-setup-card";
            card.innerHTML = `
                <div class="member-card-header">
                    <img src="${mem.avatar}" alt="${mem.name}" class="member-avatar">
                    <div class="member-card-details">
                        <h3>${mem.name}</h3>
                        <span>${isHead ? 'Primary Admin' : mem.relation}</span>
                    </div>
                </div>
                <div class="member-card-stats">
                    <div class="member-stat-col">
                        <span class="member-stat-label">Documents</span>
                        <span class="member-stat-val">${docsCount}</span>
                    </div>
                    <div class="member-stat-col">
                        <span class="member-stat-label">Issues Flagged</span>
                        <span class="member-stat-val ${warnings + expCount > 0 ? 'text-danger' : 'text-success'}">${warnings + expCount}</span>
                    </div>
                </div>
                <div class="member-card-actions">
                    <button class="btn btn-outline btn-xs w-full" onclick="app.switchMember('${mId}')">
                        <i data-lucide="eye"></i> View Vault
                    </button>
                    ${!isHead ? `<button class="btn btn-outline btn-xs btn-danger" onclick="app.toast('Security override key cannot be revoked.','warning')"><i data-lucide="shield-alert"></i> Keys</button>` : ''}
                </div>
            `;
            container.appendChild(card);
        });

        // Populate table permissions
        const tbody = document.getElementById('family-permissions-tbody');
        tbody.innerHTML = '';

        Object.keys(this.members).forEach(mId => {
            const mem = this.members[mId];
            const isHead = mId === 'head';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${mem.name}</strong></td>
                <td><span class="badge badge-warning" style="background-color:var(--bg-primary);">${mem.role}</span></td>
                <td>${isHead ? 'Head of Family' : mem.relation}</td>
                <td>
                    ${isHead ? 'Master Key Access (All Vaults)' : 'Read-Only Key Delegated'}
                </td>
                <td>
                    <span class="text-success"><i data-lucide="shield-check" class="icon-xs"></i> Key escrow verified</span>
                </td>
                <td>
                    ${!isHead ? `<button class="btn btn-outline btn-xs" onclick="app.toast('Encryption keys re-negotiated successfully.','success')"><i data-lucide="key"></i> Rotate Key</button>` : 'Master Control'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    renderSettings() {
        const planTierEl = document.getElementById('settings-plan-tier');
        if (planTierEl) {
            planTierEl.innerText = this.billingTier === 'free' ? 'Free Household Tier' : 'FamilyKYCManager Plan';
        }

        const membersCountEl = document.getElementById('settings-members-count');
        if (membersCountEl) {
            const count = Object.keys(this.members).length;
            membersCountEl.innerText = `Linked Family Members: ${count} connected profiles managed under this household account.`;
        }

        const headMember = this.members['head'];
        if (headMember) {
            const nameInput = document.getElementById('settings-admin-name');
            if (nameInput && nameInput.value !== headMember.name) {
                nameInput.value = headMember.name;
            }
            
            const addrInput = document.getElementById('settings-address');
            if (addrInput && addrInput.value !== headMember.address) {
                addrInput.value = headMember.address || '';
            }
        }
    }

    updateSettingsName(newName) {
        if (!newName || !newName.trim()) return;
        this.members['head'].name = newName.trim();
        this.updateActiveUserUI();
        this.toast(`Primary Admin name updated to "${newName.trim()}".`, 'success');
        
        this.actionTimeline.unshift({
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            title: 'Admin Profile Updated',
            desc: `Primary Admin name updated to ${newName.trim()}.`,
            status: 'completed'
        });
    }

    updateSettingsAddress(newAddress) {
        if (!newAddress || !newAddress.trim()) return;
        this.members['head'].address = newAddress.trim();
        this.toast("Primary Admin address updated in profile.", "success");
        
        this.actionTimeline.unshift({
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            title: 'Admin Address Updated',
            desc: `Primary Admin residential address updated.`,
            status: 'completed'
        });
        
        // Immediately run KYC scanner since documents are cross-checked against profile address!
        this.runFullKYCScan();
    }

    renderKYCAudit() {
        const warningsList = document.getElementById('kyc-warnings-list');
        warningsList.innerHTML = '';

        // If free plan, block KYC cross-scan!
        if (this.billingTier === 'free') {
            warningsList.innerHTML = `
                <div class="family-paywall-overlay" style="padding:32px; border-style:dashed;">
                    <div class="paywall-card">
                        <div class="paywall-icon"><i data-lucide="lock"></i></div>
                        <h3>Automated Cross-Check Mismatches Locked</h3>
                        <p style="font-size:12px;">Automatic KYC database verification and spellcheck matching across PAN, Passport and Aadhaar requires a Family Pro Upgrade.</p>
                        <button class="btn btn-gold btn-sm mt-md" onclick="app.switchTab('subscription')">Upgrade to Pro</button>
                    </div>
                </div>
            `;
            return;
        }

        if (this.kycWarnings.length === 0) {
            warningsList.innerHTML = `
                <div class="empty-state" style="padding:40px;">
                    <i data-lucide="badge-check" class="text-success" style="width:48px; height:48px; margin-bottom:16px;"></i>
                    <h3>All Document KYC details align!</h3>
                    <p>No name typos, date of birth conflicts or old address fields were detected by the sentinel.</p>
                </div>
            `;
            return;
        }

        this.kycWarnings.forEach(wr => {
            const item = document.createElement('div');
            item.className = `kyc-warning-item ${wr.severity === 'critical' ? 'critical' : ''}`;
            
            const severityBadge = wr.severity === 'critical' 
                ? '<span class="badge badge-danger">Critical Discrepancy</span>'
                : '<span class="badge badge-warning">Consistency Warning</span>';

            item.innerHTML = `
                <div class="kyc-warning-header">
                    <div class="kyc-w-title-area">
                        <span class="kyc-w-title">${wr.field} Conflict</span>
                        <span class="kyc-w-member-badge">${wr.memberName}</span>
                        ${severityBadge}
                    </div>
                    <button class="btn btn-primary btn-xs" onclick="app.openResolutionModal('${wr.id}')">
                        <i data-lucide="wrench"></i> Resolve Loop
                    </button>
                </div>
                <p class="kyc-w-desc">${wr.desc}</p>
                <div class="kyc-w-comparison">
                    <div class="comparison-header-row">
                        <span>Document Source</span>
                        <span>Extracted Metadata Value</span>
                    </div>
                    <div class="comparison-row mt-sm">
                        <span class="comp-doc">${wr.anchorDocType} (Anchor)</span>
                        <div><span class="comp-val">${wr.value1}</span></div>
                    </div>
                    <div class="comparison-row mt-sm">
                        <span class="comp-doc">${wr.docType} (Conflict)</span>
                        <div><span class="comp-val mismatch">${wr.value2}</span></div>
                    </div>
                </div>
            `;
            warningsList.appendChild(item);
        });
    }

    runFullKYCScanWithFeedback() {
        const spinner = document.getElementById('kyc-scan-spinner');
        spinner.classList.add('animate-spin');
        
        setTimeout(() => {
            spinner.classList.remove('animate-spin');
            this.runFullKYCScan();
            this.renderAll();
            this.toast("Full vault KYC database scan completed.", "success");
        }, 800);
    }

    renderRenewalsPanel() {
        const list = document.getElementById('renewals-list-container');
        list.innerHTML = '';

        if (this.expiryAlerts.length === 0) {
            list.innerHTML = `
                <div class="empty-state" style="padding:40px;">
                    <i data-lucide="check" class="text-success" style="width:48px; height:48px; margin-bottom:16px;"></i>
                    <h3>No Expiries Approaching</h3>
                    <p>All documents have valid timelines and active renewals. Rest easy.</p>
                </div>
            `;
            return;
        }

        this.expiryAlerts.forEach(al => {
            const item = document.createElement('div');
            item.className = `renewal-item ${al.priority === 'danger' ? 'danger' : 'warning'}`;
            
            const badgeClass = al.priority === 'danger' ? 'badge-danger' : 'badge-warning';

            item.innerHTML = `
                <div class="renewal-info-area">
                    <div class="renewal-title-row">
                        <span class="renewal-title">${al.docType} Expiry Alert</span>
                        <span class="renewal-owner">${al.ownerName}</span>
                        <span class="badge ${badgeClass}">${al.daysRemaining <= 0 ? 'Lapsed' : `${al.daysRemaining} days remaining`}</span>
                    </div>
                    <p class="renewal-msg">${al.message}</p>
                    <div class="renewal-meta">
                        <span>Doc No: <strong>${al.docNum}</strong></span>
                        <span>Date Due: <strong>${this.formatDateStr(al.expiryDate)}</strong></span>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="app.openRenewalActionModal('${al.id}')">
                    <i data-lucide="refresh-cw"></i> Renew & Close Loop
                </button>
            `;
            list.appendChild(item);
        });

        // Render timeline
        const timeline = document.getElementById('renewals-timeline');
        timeline.innerHTML = '';

        if (this.actionTimeline.length === 0) {
            timeline.innerHTML = '<p class="text-xs text-muted">No historical transactions logged.</p>';
            return;
        }

        this.actionTimeline.forEach(t => {
            const item = document.createElement('div');
            item.className = `timeline-item ${t.status === 'completed' ? 'completed' : 'pending'}`;
            item.innerHTML = `
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                    <span class="timeline-time">${t.time}</span>
                    <span class="timeline-title">${t.title}</span>
                    <span class="timeline-desc">${t.desc}</span>
                </div>
            `;
            timeline.appendChild(item);
        });
    }

    renderCommsLogList(filter = 'all') {
        const list = document.getElementById('comms-logs-list');
        list.innerHTML = '';
        
        let filtered = this.commsLog;
        if (filter !== 'all') {
            filtered = filtered.filter(l => l.channel === filter);
        }

        if (filtered.length === 0) {
            list.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted); font-size:13px;">No outgoing alerts recorded.</div>';
            return;
        }

        filtered.forEach(log => {
            const card = document.createElement('div');
            card.className = `comms-log-card ${log.channel}`;
            
            const icon = log.channel === 'sms' ? 'smartphone' : 'mail';
            const channelTag = log.channel === 'sms' ? 'SMS Notification' : 'Email Dispatch';

            card.innerHTML = `
                <div class="channel-icon-col">
                    <i data-lucide="${icon}"></i>
                </div>
                <div class="comms-content-col">
                    <div class="comms-meta-row">
                        <span class="comms-channel-tag text-success">${channelTag}</span>
                        <span class="comms-time-stamp">${log.timestamp}</span>
                    </div>
                    <div class="comms-subject">${log.subject}</div>
                    <div style="font-size:11px; font-weight:600; color:var(--text-secondary); margin-bottom:4px;">To: ${log.recipient}</div>
                    <div class="comms-body-text">${log.body}</div>
                    <div class="comms-action-row">
                        <button class="btn btn-outline btn-xs" onclick="app.toast('Alert dispatched again manually.','success')"><i data-lucide="send"></i> Resend Alert</button>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    }

    // --- LIFE EVENT MAPPING sentinel engine ---
    calculateLifeEvents() {
        this.lifeEvents.forEach(evt => {
            // If Free tier and target member is not 'head', lock the event (0% progress)
            if (this.billingTier === 'free' && evt.targetMember !== 'head') {
                evt.progress = 0;
                evt.locked = true;
                evt.tasks.forEach(t => t.status = 'locked');
                return;
            }

            evt.locked = false;
            let completedCount = 0;
            const targetM = evt.targetMember;
            const memberDocs = this.documents.filter(d => d.owner === targetM);
            const anchorType = this.selectedCountry === 'US' ? 'SSN Card' : (this.selectedCountry === 'UK' ? 'NINO Card' : 'Aadhaar');
            const anchorDoc = memberDocs.find(d => d.type === anchorType);

            evt.tasks.forEach(task => {
                const doc = memberDocs.find(d => d.type === task.docType);
                
                if (!doc) {
                    task.status = 'incomplete';
                    task.message = `Missing document: ${task.docType} is not uploaded.`;
                    return;
                }

                if (task.checkType === 'anchor-name') {
                    task.status = 'completed';
                    task.message = `Verified: ${doc.type} name matches family record ("${doc.kycName}").`;
                    completedCount++;
                } else if (task.checkType === 'anchor-address') {
                    task.status = 'completed';
                    task.message = `Verified: ${doc.type} address is registered as current residence.`;
                    completedCount++;
                } else if (task.checkType === 'match-anchor-name') {
                    if (anchorDoc && doc.kycName.trim().toLowerCase() === anchorDoc.kycName.trim().toLowerCase()) {
                        task.status = 'completed';
                        task.message = `Aligned: Name matches spouse Aadhaar ("${doc.kycName}").`;
                        completedCount++;
                    } else {
                        task.status = 'pending';
                        task.message = `Mismatch: Name on ${doc.type} is "${doc.kycName}" but Aadhaar is "${anchorDoc ? anchorDoc.kycName : ''}".`;
                    }
                } else if (task.checkType === 'match-anchor-address') {
                    if (anchorDoc) {
                        const clean1 = this.cleanAddress(anchorDoc.kycAddress);
                        const clean2 = this.cleanAddress(doc.kycAddress);
                        if (clean1 === clean2) {
                            task.status = 'completed';
                            task.message = `Aligned: Address matches Dwarka residence.`;
                            completedCount++;
                        } else {
                            task.status = 'pending';
                            task.message = `Address discrepancy: ${doc.type} address is slightly inconsistent or needs sync.`;
                        }
                    } else {
                        task.status = 'incomplete';
                    }
                }
            });

            evt.progress = Math.round((completedCount / evt.tasks.length) * 100);
        });

        // Update badge count
        const activeCount = this.lifeEvents.filter(e => e.progress < 100 && (!e.locked)).length;
        const badge = document.getElementById('life-events-badge');
        if (badge) {
            badge.innerText = `${activeCount} Active`;
            if (activeCount === 0) {
                badge.className = "badge badge-success";
            } else {
                badge.className = "badge badge-warning";
            }
        }
    }

    renderLifeEvents() {
        this.calculateLifeEvents();

        const selectList = document.getElementById('life-events-select-list');
        selectList.innerHTML = '';

        this.lifeEvents.forEach(evt => {
            const isActive = this.activeLifeEvent === evt.id;
            
            const item = document.createElement('div');
            item.className = `life-event-item ${isActive ? 'active' : ''}`;
            
            let statusText = `${evt.progress}% Completed`;
            if (evt.locked) statusText = '<i data-lucide="lock" style="width:10px; height:10px; display:inline;"></i> Locked (Pro)';

            item.innerHTML = `
                <div class="life-event-item-info">
                    <h4>${evt.title}</h4>
                    <span>${statusText}</span>
                </div>
                <i data-lucide="chevron-right" style="width:16px; height:16px;"></i>
            `;

            item.onclick = () => {
                this.switchLifeEvent(evt.id);
            };

            selectList.appendChild(item);
        });

        // Render active details
        const activeEvt = this.lifeEvents.find(e => e.id === this.activeLifeEvent);
        document.getElementById('active-event-title').innerText = activeEvt.title;
        document.getElementById('active-event-progress').innerText = activeEvt.locked ? 'Locked' : `${activeEvt.progress}% Complete`;
        document.getElementById('active-event-progress').className = activeEvt.progress === 100 ? 'badge badge-success' : 'badge badge-warning';
        document.getElementById('active-event-desc').innerText = activeEvt.desc;

        const stepperContainer = document.getElementById('life-event-stepper-container');
        stepperContainer.innerHTML = '';

        if (activeEvt.locked) {
            stepperContainer.innerHTML = `
                <div class="family-paywall-overlay" style="padding: 24px; border: 1px dashed var(--border-color); border-radius: var(--border-radius-lg);">
                    <div class="paywall-card" style="max-width:100%;">
                        <div class="paywall-icon"><i data-lucide="lock"></i></div>
                        <h4>Spouse name change roadmap is locked</h4>
                        <p style="font-size:12px; margin-bottom:16px;">Tracking life event dependency updates for family members requires an active Family Pro subscription.</p>
                        <button class="btn btn-gold btn-sm" onclick="app.switchTab('subscription')">Upgrade to Pro</button>
                    </div>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        activeEvt.tasks.forEach(task => {
            const stepCard = document.createElement('div');
            stepCard.className = `stepper-step ${task.status === 'completed' ? 'completed' : 'pending'}`;
            
            const icon = task.status === 'completed' ? 'check' : 'alert-circle';
            
            // Action button logic
            let actionBtn = '';
            if (task.status === 'pending') {
                const targetM = activeEvt.targetMember;
                const anchorType = this.selectedCountry === 'US' ? 'SSN Card' : (this.selectedCountry === 'UK' ? 'NINO Card' : 'Aadhaar');
                const anchorDoc = this.documents.find(d => d.owner === targetM && d.type === anchorType);
                
                if (task.checkType === 'match-anchor-name' && anchorDoc) {
                    actionBtn = `<button class="btn btn-accent btn-xs" onclick="app.syncLifeEventTask('${activeEvt.id}', '${task.id}', '${anchorDoc.kycName}')">Sync Name</button>`;
                } else if (task.checkType === 'match-anchor-address' && anchorDoc) {
                    actionBtn = `<button class="btn btn-accent btn-xs" onclick="app.syncLifeEventTask('${activeEvt.id}', '${task.id}', '${anchorDoc.kycAddress}')">Sync Address</button>`;
                }
            }

            const doc = this.documents.find(d => d.owner === activeEvt.targetMember && d.type === task.docType);
            let comparisonBlock = '';
            if (doc && task.status === 'pending') {
                const anchorType = this.selectedCountry === 'US' ? 'SSN Card' : (this.selectedCountry === 'UK' ? 'NINO Card' : 'Aadhaar');
                const anchorDoc = this.documents.find(d => d.owner === activeEvt.targetMember && d.type === anchorType);
                const fieldName = task.checkType.includes('name') ? 'Name' : 'Address';
                const anchorVal = task.checkType.includes('name') ? anchorDoc.kycName : anchorDoc.kycAddress;
                const docVal = task.checkType.includes('name') ? doc.kycName : doc.kycAddress;

                comparisonBlock = `
                    <div class="step-compare-card mt-sm">
                        <div class="step-compare-row">
                            <span class="label">Anchor (${anchorDoc.type}) ${fieldName}:</span>
                            <span class="val">${anchorVal}</span>
                        </div>
                        <div class="step-compare-row">
                            <span class="label">Current (${doc.type}) ${fieldName}:</span>
                            <span class="val mismatch">${docVal}</span>
                        </div>
                    </div>
                `;
            }

            stepCard.innerHTML = `
                <div class="step-status-icon-wrapper">
                    <i data-lucide="${icon}"></i>
                </div>
                <div class="step-content-col">
                    <div class="step-title-row">
                        <h4>${task.title}</h4>
                        <span class="badge ${task.status === 'completed' ? 'badge-success' : 'badge-warning'}">${task.status.toUpperCase()}</span>
                    </div>
                    <p class="step-desc">${task.desc}</p>
                    <p class="text-xs text-muted mb-sm">${task.message}</p>
                    ${comparisonBlock}
                    <div class="step-action-row">
                        ${actionBtn}
                    </div>
                </div>
            `;

            stepperContainer.appendChild(stepCard);
        });

        lucide.createIcons();
    }

    switchLifeEvent(evtId) {
        this.activeLifeEvent = evtId;
        this.renderLifeEvents();
    }

    syncLifeEventTask(evtId, taskId, targetValue) {
        const evt = this.lifeEvents.find(e => e.id === evtId);
        const task = evt.tasks.find(t => t.id === taskId);
        
        const doc = this.documents.find(d => d.owner === evt.targetMember && d.type === task.docType);
        
        if (doc) {
            if (task.checkType.includes('name')) {
                const oldName = doc.kycName;
                doc.kycName = targetValue;
                doc.status = 'valid';
                this.toast(`Synchronized ${doc.type} name to "${targetValue}".`, "success");
                
                this.actionTimeline.unshift({
                    time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    title: 'Life Event Document Aligned',
                    desc: `Synchronized ${this.members[doc.owner].name}'s ${doc.type} name to Aadhaar anchor post-marriage.`,
                    status: 'completed'
                });
            } else if (task.checkType.includes('address')) {
                doc.kycAddress = targetValue;
                doc.status = 'valid';
                this.toast(`Synchronized ${doc.type} address to current residence.`, "success");

                this.actionTimeline.unshift({
                    time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    title: 'Relocation Address Synced',
                    desc: `Synchronized ${this.members[doc.owner].name}'s ${doc.type} address to Dwarka Apartments post-relocation.`,
                    status: 'completed'
                });
            }

            // Dispatch log entry confirmation
            this.addResolutionCommsAlert(doc.owner, doc.type, `Life Event Alignment`);

            this.runFullKYCScan();
            this.runExpiryCheck();
            this.renderAll();
        }
    }

    // --- SECURITY AUTHORIZATION & AUTHENTICATION HANDLERS ---
    setLoginRole(role) {
        this.loginRole = role;
        
        const headBtn = document.getElementById('role-head');
        const spouseBtn = document.getElementById('role-spouse');
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const otpInput = document.getElementById('login-otp');
        
        if (role === 'head') {
            headBtn.classList.add('active');
            spouseBtn.classList.remove('active');
            emailInput.value = 'vikram.garg@gmail.com';
            passwordInput.value = '••••••••••••';
            otpInput.value = '542190';
        } else {
            headBtn.classList.remove('active');
            spouseBtn.classList.add('active');
            emailInput.value = 'sunita.garg@gmail.com';
            passwordInput.value = '••••••••••••';
            otpInput.value = '192840';
        }
    }

    handleLogin(event) {
        event.preventDefault();
        
        const unlockBtn = document.getElementById('btn-login-unlock');
        const originalHtml = unlockBtn.innerHTML;
        
        unlockBtn.disabled = true;
        unlockBtn.innerHTML = '<span class="loading-spinner" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; width: 12px; height: 12px; display: inline-block; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: middle;"></span> Authenticating Ledger...';
        
        setTimeout(() => {
            // Success! Set active user context
            this.activeMember = this.loginRole;
            
            // Adjust sidebar profile visibility/actions based on access role
            const switcherTrigger = document.querySelector('.profile-btn');
            
            if (this.activeMember === 'spouse') {
                if (switcherTrigger) {
                    switcherTrigger.style.pointerEvents = 'none';
                    switcherTrigger.style.opacity = '0.7';
                }
                
                // Switch to Pro mode to support Sunita's family profile checks automatically,
                // but lock controls.
                this.billingTier = 'pro'; 
                
                this.toast("Logged in as Family Member (Sunita Garg). Vault limited to spouse scope.", "info");
            } else {
                if (switcherTrigger) {
                    switcherTrigger.style.pointerEvents = 'auto';
                    switcherTrigger.style.opacity = '1';
                }
                // Reset default billing tier for head
                this.billingTier = 'free';
                this.toast("Decrypted Secure Vault. Owner Access Level unlocked.", "success");
            }
            
            // Hide marketing landing page, show app
            document.getElementById('marketing-page').classList.add('hidden');
            document.querySelector('.app-container').classList.remove('hidden');
            
            // Adjust body scroll classes
            document.body.classList.remove('vault-locked');
            document.body.classList.add('vault-unlocked');
            
            // Restore button
            unlockBtn.disabled = false;
            unlockBtn.innerHTML = originalHtml;
            
            this.updateActiveUserUI();
            this.switchTab('dashboard');
        }, 1200);
    }

    switchAuthMode(mode) {
        const signinTab = document.getElementById('tab-signin');
        const signupTab = document.getElementById('tab-signup');
        const signinContainer = document.getElementById('signin-view-container');
        const signupContainer = document.getElementById('signup-view-container');
        const authTitle = document.getElementById('auth-title');
        const authSubtitle = document.getElementById('auth-subtitle');
        
        if (mode === 'signin') {
            signinTab.classList.add('active');
            signinTab.style.borderBottom = '2px solid var(--accent)';
            signinTab.style.color = 'var(--accent)';
            signinTab.style.fontWeight = '700';
            
            signupTab.classList.remove('active');
            signupTab.style.borderBottom = '2px solid transparent';
            signupTab.style.color = '#64748b';
            signupTab.style.fontWeight = '600';
            
            signinContainer.classList.remove('hidden');
            signupContainer.classList.add('hidden');
            
            authTitle.innerText = "Unlock Family Vault";
            authSubtitle.innerText = "E2E LOCAL DECRYPTION & AUTHORIZATION GATE";
        } else {
            signupTab.classList.add('active');
            signupTab.style.borderBottom = '2px solid var(--accent)';
            signupTab.style.color = 'var(--accent)';
            signupTab.style.fontWeight = '700';
            
            signinTab.classList.remove('active');
            signinTab.style.borderBottom = '2px solid transparent';
            signinTab.style.color = '#64748b';
            signinTab.style.fontWeight = '600';
            
            signupContainer.classList.remove('hidden');
            signinContainer.classList.add('hidden');
            
            authTitle.innerText = "Register New Vault";
            authSubtitle.innerText = "CREATE SECURE METADATA LEDGER & LOCALIZE";
        }
    }

    handleSignup(event) {
        event.preventDefault();
        
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const pin = document.getElementById('signup-otp').value;
        const country = document.getElementById('signup-country-select').value;
        
        if (!email || !password || !pin) {
            this.toast("Please fill in all registration fields.", "warning");
            return;
        }

        // Set country explicitly
        this.selectedCountry = country;
        this.documents = this.getLocalizedDocuments(country);
        this.notifications = this.getLocalizedNotifications(country);
        this.commsLog = this.getLocalizedCommsLog(country);
        this.lifeEvents = this.getLocalizedLifeEvents(country);
        this.updateLocalizedMarketingCopy(country);

        // Set the active user profile name based on email prefix or phone number
        let displayName = email;
        if (email.includes('@')) {
            displayName = email.split('@')[0];
        }
        this.members.head.name = displayName.replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        // Simulating Registration success loading state
        const btn = event.target.querySelector('button[type="submit"]');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<span class="loading-spinner" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; width: 12px; height: 12px; display: inline-block; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: middle;"></span> Registering Vault...`;
        btn.disabled = true;

        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            
            // Decrypt dashboard view
            document.getElementById('marketing-page').classList.add('hidden');
            document.querySelector('.app-container').classList.remove('hidden');
            
            // Toggle body scrolling class state
            document.body.classList.remove('vault-locked');
            document.body.classList.add('vault-unlocked');
            
            this.toast("Vault successfully registered and unlocked!", "success");
            
            // Re-render dashboard
            this.activeMember = 'head';
            this.billingTier = 'free';
            this.updateActiveUserUI();
            this.switchTab('dashboard');
            this.runFullKYCScan();
            this.runExpiryCheck();
            this.renderAll();
        }, 1500);
    }

    handleSignOut() {
        // Clear login form fields
        document.getElementById('login-password').value = '';
        document.getElementById('login-otp').value = '';
        
        // Hide dashboard, show marketing page
        document.querySelector('.app-container').classList.add('hidden');
        this.showMarketingPage();
        
        this.toast("E2E session locked. Encryption keys cleared.", "warning");
    }

    showLoginPage(role) {
        this.setLoginRole(role);
        const anchor = document.getElementById('login-form-anchor');
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
    }

    showMarketingPage() {
        document.getElementById('marketing-page').classList.remove('hidden');
        document.body.classList.remove('vault-unlocked');
        document.body.classList.add('vault-locked');
    }

    // --- UI HELPERS ---
    toast(message, type = 'info') {
        const stack = document.getElementById('toast-stack');
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'info';
        if (type === 'success') icon = 'check-circle-2';
        if (type === 'warning') icon = 'alert-triangle';
        if (type === 'danger') icon = 'x-circle';

        toast.innerHTML = `
            <i data-lucide="${icon}"></i>
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()"><i data-lucide="x"></i></button>
        `;
        
        stack.appendChild(toast);
        lucide.createIcons();
        
        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    formatDateStr(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const options = { year: 'numeric', month: 'short', day: '2-digit' };
        return date.toLocaleDateString('en-IN', options);
    }

    // --- SUPABASE CLOUD & CLIENT-SIDE OCR ENGINE ---
    initSupabaseCloudSync() {
        if (window.SupabaseVaultConfig && window.SupabaseVaultConfig.init()) {
            this.isCloudSyncActive = true;
            this.toast("🟢 Connected to Supabase Cloud Vault!", "success");
            this.loadCloudVaultData();
        } else {
            this.isCloudSyncActive = false;
            this.loadLocalVaultCache();
        }
    }

    async loadCloudVaultData() {
        if (!this.isCloudSyncActive) return;
        try {
            const client = window.SupabaseVaultConfig.client;
            const { data: docs, error: docErr } = await client.from('vault_documents').select('*');
            if (!docErr && docs && docs.length > 0) {
                console.log("[Supabase] Loaded documents from cloud database:", docs);
                this.documents = docs.map(d => ({
                    id: d.id,
                    owner: d.member_key || 'head',
                    type: d.doc_type,
                    number: d.doc_number,
                    kycName: d.kyc_name,
                    kycDob: d.kyc_dob,
                    kycAddress: d.kyc_address,
                    expiryDate: d.expiry_date,
                    status: d.status || 'valid'
                }));
                this.runSanityCheck();
                this.runExpiryCheck();
                this.renderDocumentsList();
            }
        } catch (err) {
            console.warn("⚠️ Failed to load cloud vault data, using offline fallback", err);
        }
    }

    async syncDocumentToCloud(doc) {
        this.saveLocalVaultCache();
        if (!this.isCloudSyncActive) return;
        try {
            const client = window.SupabaseVaultConfig.client;
            const { data, error } = await client.from('vault_documents').upsert({
                doc_type: doc.type,
                doc_number: doc.number,
                kyc_name: doc.kycName,
                kyc_dob: doc.kycDob,
                kyc_address: doc.kycAddress,
                expiry_date: doc.expiryDate,
                member_key: doc.owner,
                status: doc.status || 'valid'
            });
            if (error) console.warn("[Supabase] Cloud sync error:", error);
            else console.log("[Supabase] Synced document to cloud vault:", data);
        } catch (e) {
            console.warn("⚠️ Cloud sync exception:", e);
        }
    }

    saveLocalVaultCache() {
        try {
            localStorage.setItem('family_kyc_documents', JSON.stringify(this.documents));
            localStorage.setItem('family_kyc_members', JSON.stringify(this.members));
            localStorage.setItem('family_kyc_actionTimeline', JSON.stringify(this.actionTimeline));
        } catch (e) {
            console.warn("LocalStorage save error", e);
        }
    }

    loadLocalVaultCache() {
        try {
            const savedDocs = localStorage.getItem('family_kyc_documents');
            const savedMembers = localStorage.getItem('family_kyc_members');
            const savedTimeline = localStorage.getItem('family_kyc_actionTimeline');
            if (savedDocs) this.documents = JSON.parse(savedDocs);
            if (savedMembers) this.members = JSON.parse(savedMembers);
            if (savedTimeline) this.actionTimeline = JSON.parse(savedTimeline);
        } catch (e) {
            console.warn("LocalStorage load error", e);
        }
    }

    // --- CLIENT-SIDE OCR DOCUMENT SCANNER ---
    async handleFileSelected(file) {
        this.uploadedFile = file;
        this.toast(`Processing ${file.name}... Scanning text via Tesseract OCR`, "info");
        
        const fileInfoElem = document.getElementById('selected-file-info');
        if (fileInfoElem) {
            fileInfoElem.innerHTML = `<i data-lucide="file-text"></i> <span>${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>`;
            fileInfoElem.classList.remove('hidden');
        }

        if (file.type.startsWith('image/') && typeof Tesseract !== 'undefined') {
            try {
                this.toast("🔍 Running client-side Tesseract OCR scanner...", "info");
                const worker = await Tesseract.createWorker('eng');
                const ret = await worker.recognize(file);
                const text = ret.data.text;
                await worker.terminate();
                
                console.log("[Tesseract OCR Scanned Text]:", text);
                this.parseAndAutoFillOCR(text);
                this.toast("✨ OCR Scan Complete! Extracted document data.", "success");
            } catch (err) {
                console.warn("OCR Scan error:", err);
                this.toast("File attached. Ready for document registration.", "info");
            }
        } else {
            this.toast("File attached successfully.", "info");
        }
    }

    parseAndAutoFillOCR(text) {
        if (!text) return;
        const upper = text.toUpperCase();
        
        let detectedType = null;
        if (upper.includes('AADHAAR') || upper.includes('GOVERNMENT OF INDIA') || /\d{4}\s\d{4}\s\d{4}/.test(text)) {
            detectedType = 'Aadhaar';
        } else if (upper.includes('INCOME TAX') || upper.includes('PERMANENT ACCOUNT') || /[A-Z]{5}[0-9]{4}[A-Z]{1}/.test(upper)) {
            detectedType = 'PAN';
        } else if (upper.includes('PASSPORT') || /PASSPORT/i.test(text)) {
            detectedType = 'Passport';
        } else if (upper.includes('DRIVING') || upper.includes('LICENCE') || upper.includes('LICENSE')) {
            detectedType = 'Driving License';
        }

        let docNum = null;
        const aadhaarMatch = text.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
        const panMatch = upper.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
        const passMatch = upper.match(/[A-Z][0-9]{7}/);

        if (aadhaarMatch) docNum = aadhaarMatch[0];
        else if (panMatch) docNum = panMatch[0];
        else if (passMatch) docNum = passMatch[0];

        const expMatch = text.match(/(EXP|EXPIRY|VALID TILL|VALID UPTO)[\s:-]*([0-9]{2}[\/\.-][0-9]{2}[\/\.-][0-9]{4})/i);
        let expDate = null;
        if (expMatch && expMatch[2]) {
            const parts = expMatch[2].split(/[\/\.-]/);
            if (parts.length === 3) {
                expDate = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
            }
        }

        const typeSelect = document.getElementById('upload-doc-type');
        const numInput = document.getElementById('upload-doc-number');
        const expInput = document.getElementById('upload-doc-expiry');

        if (typeSelect && detectedType) typeSelect.value = detectedType;
        if (numInput && docNum) numInput.value = docNum;
        if (expInput && expDate) expInput.value = expDate;
    }
}

// Global Launcher
const app = new FamilyKYCManager();
window.onload = () => {
    app.init();
};
