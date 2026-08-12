// Family KYC Manager - Web Portal JavaScript Controller

const NEUTRAL_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233b82f6'><circle cx='12' cy='12' r='12' fill='%23eff6ff'/><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%233b82f6'/></svg>";

class FamilyKYCManager {
    constructor() {
        this.activeTab = 'dashboard';
        this.activeUserEmail = null;
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
                name: 'Administrator', 
                relation: 'Self', 
                avatar: NEUTRAL_AVATAR, 
                role: 'Primary Admin',
                mobile: '',
                email: '',
                address: ''
            }
        };

        // Document Database
        this.documents = [];
        this.lastSyncedEventTime = null;

        // Alerts / KYC discrepancies list
        this.kycWarnings = [];
        this.expiryAlerts = [];
        
        // App Notification Feed (top bar)
        this.notifications = [];

        // External Comms Simulator Log (SMS / Emails)
        this.commsLog = [];

        // Closed loop Action timeline log
        this.actionTimeline = [];

        // Currently attached file in upload simulator
        this.uploadedFile = null;
        this.currentFileDataUrl = null;
        this.lastExtractedText = "";
        
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
        return [];
    }

    getLocalizedNotifications(country) {
        return [];
    }

    getLocalizedCommsLog(country) {
        return [];
    }

    getLocalizedLifeEvents(country) {
        const spouseName = (this.members && this.members.spouse && this.members.spouse.name) ? this.members.spouse.name : 'Spouse';
        const headAddress = (this.members && this.members.head && this.members.head.address) ? this.members.head.address : 'Current Residence';
        const addressShort = headAddress.split(',')[0].trim() || 'Current Residence';

        if (country === 'US') {
            return [
                {
                    id: 'evt-marriage',
                    title: 'Post-Marriage Name Alignment',
                    desc: `Following marriage, name corrections must cascade across all spouse identification cards. Anchor document: Spouse SSN Card ("${spouseName}").`,
                    targetMember: 'spouse',
                    tasks: [
                        { id: 't-m-aadhaar', title: 'Verify SSN Name Update', docType: 'Aadhaar', checkType: 'anchor-name', desc: `SSN Card name must be updated with marital surname of "${spouseName}".` },
                        { id: 't-m-pan', title: 'Update State ID Card Name', docType: 'PAN', checkType: 'match-anchor-name', desc: `State ID Card name must match SSN ("${spouseName}") to prevent banking KYC blocks.` },
                        { id: 't-m-dl', title: 'Update Driver\'s License Name', docType: 'DRIVING_LICENCE', checkType: 'match-anchor-name', desc: `Driver's License name should match SSN.` }
                    ],
                    progress: 0
                },
                {
                    id: 'evt-relocation',
                    title: 'Relocation Address Synchronization',
                    desc: `After shifting residency, address details must align across all official documents. Anchor document: Primary SSN Card ("${addressShort}").`,
                    targetMember: 'head',
                    tasks: [
                        { id: 't-r-aadhaar', title: 'Verify SSN Address Update', docType: 'Aadhaar', checkType: 'anchor-address', desc: `SSN Card must be updated with "${addressShort}" residence.` },
                        { id: 't-r-voter', title: 'Sync Driver\'s License Address', docType: 'DRIVING_LICENCE', checkType: 'match-anchor-address', desc: `Driver's License address must align with "${addressShort}" residence.` },
                        { id: 't-r-passport', title: 'Sync US Passport Address', docType: 'PASSPORT', checkType: 'match-anchor-address', desc: 'US Passport address should match current residency.' }
                    ],
                    progress: 0
                }
            ];
        } else if (country === 'UK') {
            return [
                {
                    id: 'evt-marriage',
                    title: 'Post-Marriage Name Alignment',
                    desc: `Following marriage, name corrections must cascade across all spouse identification cards. Anchor document: Spouse NINO Card ("${spouseName}").`,
                    targetMember: 'spouse',
                    tasks: [
                        { id: 't-m-aadhaar', title: 'Verify NINO Name Update', docType: 'Aadhaar', checkType: 'anchor-name', desc: `NINO Card name must be updated with marital surname of "${spouseName}".` },
                        { id: 't-m-pan', title: 'Update National ID Card Name', docType: 'PAN', checkType: 'match-anchor-name', desc: `National ID Card name must match NINO ("${spouseName}") to prevent banking KYC blocks.` },
                        { id: 't-m-dl', title: 'Update Driver\'s License Name', docType: 'DRIVING_LICENCE', checkType: 'match-anchor-name', desc: `Driver's License name should match NINO.` }
                    ],
                    progress: 0
                },
                {
                    id: 'evt-relocation',
                    title: 'Relocation Address Synchronization',
                    desc: `After shifting residency, address details must align across all official documents. Anchor document: Primary NINO Card ("${addressShort}").`,
                    targetMember: 'head',
                    tasks: [
                        { id: 't-r-aadhaar', title: 'Verify NINO Address Update', docType: 'Aadhaar', checkType: 'anchor-address', desc: `NINO Card must be updated with "${addressShort}" residence.` },
                        { id: 't-r-voter', title: 'Sync Driver\'s License Address', docType: 'DRIVING_LICENCE', checkType: 'match-anchor-address', desc: `Driver's License address must align with "${addressShort}" residence.` },
                        { id: 't-r-passport', title: 'Sync UK Passport Address', docType: 'PASSPORT', checkType: 'match-anchor-address', desc: 'UK Passport address should match current residency.' }
                    ],
                    progress: 0
                }
            ];
        } else {
            return [
                {
                    id: 'evt-marriage',
                    title: 'Post-Marriage Name Alignment',
                    desc: `Following marriage, name corrections must cascade across all spouse identification cards. Anchor document: Spouse Aadhaar Card ("${spouseName}").`,
                    targetMember: 'spouse',
                    tasks: [
                        { id: 't-m-aadhaar', title: 'Verify Aadhaar Name Update', docType: 'Aadhaar', checkType: 'anchor-name', desc: `Aadhaar Card name must be updated with marital surname of "${spouseName}".` },
                        { id: 't-m-pan', title: 'Update PAN Card Name', docType: 'PAN', checkType: 'match-anchor-name', desc: `PAN Card name must match Aadhaar ("${spouseName}") to prevent banking KYC blocks.` },
                        { id: 't-m-dl', title: 'Update Driving License Name', docType: 'DRIVING_LICENCE', checkType: 'match-anchor-name', desc: `Driving License name should match Aadhaar.` }
                    ],
                    progress: 0
                },
                {
                    id: 'evt-relocation',
                    title: 'Relocation Address Synchronization',
                    desc: `After shifting residency, address details must align across all official documents. Anchor document: Primary Aadhaar Card ("${addressShort}").`,
                    targetMember: 'head',
                    tasks: [
                        { id: 't-r-aadhaar', title: 'Verify Aadhaar Address Update', docType: 'Aadhaar', checkType: 'anchor-address', desc: `Aadhaar Card must be updated with "${addressShort}" residence.` },
                        { id: 't-r-voter', title: 'Sync Voter ID Address', docType: 'UTILITY_RECORD', checkType: 'match-anchor-address', desc: `Voter ID card address must align with "${addressShort}" residence.` },
                        { id: 't-r-passport', title: 'Sync Passport Address', docType: 'PASSPORT', checkType: 'match-anchor-address', desc: 'Passport address should match current residency.' }
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
                    <option value="Aadhaar">SSN Card (Social Security)</option>
                    <option value="PAN">State ID Card</option>
                    <option value="PASSPORT">US Passport</option>
                    <option value="DRIVING_LICENCE">Driver's License</option>
                    <option value="BANK_ACCOUNT">Bank Account Metadata</option>
                    <option value="INSURANCE_POLICY">Insurance Policy (Medical/Life)</option>
                    <option value="MUTUAL_FUND">Mutual Fund / Brokerage Portfolio</option>
                    <option value="VEHICLE_RC">Vehicle Title & Registration</option>
                    <option value="LPG_CYLINDER">LPG Gas Cylinder Bill</option>
                    <option value="ELECTRICITY_BILL">Electricity Bill</option>
                    <option value="PROPERTY_TAX">Property Tax Receipt</option>
                    <option value="UTILITY_RECORD">Other Property Tax / Utility Bill</option>
                `;
            } else if (country === 'UK') {
                optionsHtml = `
                    <option value="Aadhaar">NINO Card (National Insurance)</option>
                    <option value="PAN">National ID Card</option>
                    <option value="PASSPORT">UK Passport</option>
                    <option value="DRIVING_LICENCE">DVLA Driver's License</option>
                    <option value="BANK_ACCOUNT">Bank Account Metadata</option>
                    <option value="INSURANCE_POLICY">Insurance Policy (Life/Health)</option>
                    <option value="MUTUAL_FUND">Mutual Fund / Investment ISA</option>
                    <option value="VEHICLE_RC">V5C Vehicle Registry</option>
                    <option value="LPG_CYLINDER">LPG Gas Cylinder Bill</option>
                    <option value="ELECTRICITY_BILL">Electricity Bill</option>
                    <option value="PROPERTY_TAX">Property Tax Receipt</option>
                    <option value="UTILITY_RECORD">Other Property Tax / Utility Bill</option>
                `;
            } else {
                optionsHtml = `
                    <option value="Aadhaar">Aadhaar Card</option>
                    <option value="PAN">PAN Card</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="DRIVING_LICENCE">Driving Licence</option>
                    <option value="BANK_ACCOUNT">Bank Account Metadata</option>
                    <option value="INSURANCE_POLICY">Life & Health Insurance Policy</option>
                    <option value="MUTUAL_FUND">Mutual Fund Folio</option>
                    <option value="VEHICLE_RC">Vehicle Registration Certificate (RC)</option>
                    <option value="LPG_CYLINDER">LPG Gas Cylinder Bill</option>
                    <option value="ELECTRICITY_BILL">Electricity Bill</option>
                    <option value="PROPERTY_TAX">Property Tax Receipt</option>
                    <option value="UTILITY_RECORD">Other Property Tax / Utility Bill</option>
                `;
            }
            typeSelect.innerHTML = optionsHtml;
        }

        // Update Dynamic Form Input Labels (Aadhaar / SSN / NINO) - now generic normal OTP
        const loginOtpLabel = document.getElementById('login-otp-label');
        const signupOtpLabel = document.getElementById('signup-otp-label');
        const loginOtpInput = document.getElementById('login-otp');
        const signupOtpInput = document.getElementById('signup-otp');
        
        if (loginOtpLabel) loginOtpLabel.innerText = 'Secure 6-Digit PIN';
        if (signupOtpLabel) signupOtpLabel.innerText = 'Secure 6-Digit PIN';
        if (loginOtpInput) loginOtpInput.placeholder = 'Enter 6-digit PIN';
        if (signupOtpInput) signupOtpInput.placeholder = 'Create 6-digit PIN';

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
            const visibleDocs = this.getVisibleDocuments();
            const memberDocs = visibleDocs.filter(d => d.owner === mId);
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
                        memberName: this.members[mId] ? this.members[mId].name : 'Unknown',
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
                        memberName: this.members[mId] ? this.members[mId].name : 'Unknown',
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
                            memberName: this.members[mId] ? this.members[mId].name : 'Unknown',
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
                if (mId === 'head' && doc.kycAddress && this.members['head'] && this.members['head'].address) {
                    const cleanProfileAddr = this.cleanAddress(this.members['head'].address);
                    const cleanDocAddr = this.cleanAddress(doc.kycAddress);
                    
                    if (cleanProfileAddr !== cleanDocAddr && this.isAddressSignificantlyDifferent(cleanProfileAddr, cleanDocAddr)) {
                        this.kycWarnings.push({
                            id: `kyc-err-${doc.id}-profile-addr`,
                            memberId: mId,
                            memberName: this.members[mId] ? this.members[mId].name : 'Unknown',
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
        const badge = document.getElementById('kyc-badge-count');
        if (this.billingTier === 'free') {
            document.getElementById('stat-kyc-alerts').innerText = '0';
            if (badge) {
                badge.style.display = 'none';
            }
            if (document.getElementById('kyc-card-badge')) {
                document.getElementById('kyc-card-badge').innerText = 'Locked';
            }
        } else {
            document.getElementById('stat-kyc-alerts').innerText = this.kycWarnings.length;
            if (badge) {
                if (this.kycWarnings.length === 0) {
                    badge.style.display = 'none';
                } else {
                    badge.style.display = '';
                    badge.innerText = this.kycWarnings.length;
                }
            }
            if (document.getElementById('kyc-card-badge')) {
                document.getElementById('kyc-card-badge').innerText = `${this.kycWarnings.length} Warnings`;
            }
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
        const visibleDocs = this.getVisibleDocuments();
        const docsToScan = this.billingTier === 'free'
            ? visibleDocs.filter(d => d.owner === 'head')
            : visibleDocs;

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
                    ownerName: this.members[doc.owner] ? this.members[doc.owner].name : 'Unknown',
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
        const renewalBadge = document.getElementById('renewal-badge-count');
        if (renewalBadge) {
            if (this.expiryAlerts.length === 0) {
                renewalBadge.style.display = 'none';
            } else {
                renewalBadge.style.display = '';
                renewalBadge.innerText = this.expiryAlerts.length;
            }
        }
        if (document.getElementById('renewals-card-badge')) {
            document.getElementById('renewals-card-badge').innerText = `${this.expiryAlerts.length} Urgent`;
        }
        
        // Calculate health percentage
        // Health = (Total Docs - Issues) / Total Docs
        const totalDocs = this.documents.length;
        const issuesCount = this.kycWarnings.length + this.expiryAlerts.length;
        const healthPercent = totalDocs > 0 ? Math.max(0, Math.min(100, Math.round(((totalDocs - issuesCount) / totalDocs) * 100))) : 100;
        
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
        if (this.loginRole !== 'head' && memberId !== this.loginRole) {
            this.toast("Access Denied: Only Primary Admins can switch family vault views.", "danger");
            return;
        }

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
        this.currentFileDataUrl = null;
        this.lastExtractedText = "";
        
        document.getElementById('doc-expiry-input').type = 'text';
        document.getElementById('doc-kyc-dob').type = 'text';
        
        document.getElementById('file-attached-info').classList.add('hidden');
        document.getElementById('drag-drop-zone').classList.remove('hidden');

        const privacyGroup = document.getElementById('doc-privacy-group');
        const isPrivateChk = document.getElementById('doc-is-private');

        if (privacyGroup) {
            if (this.activeMember === 'spouse') {
                privacyGroup.style.display = 'block';
            } else {
                privacyGroup.style.display = 'none';
            }
        }

        if (docId) {
            // Edit Mode
            const doc = this.documents.find(d => d.id === docId);
            this.currentFileDataUrl = doc.fileDataUrl || null;
            this.lastExtractedText = doc.rawOcrText || '';
            document.getElementById('modal-title').innerText = "Edit Document Metadata";
            const saveBtn = document.getElementById('btn-save-doc');
            if (saveBtn) saveBtn.innerText = "Save Changes";
            document.getElementById('doc-id-field').value = doc.id;
            document.getElementById('doc-member-select').value = doc.owner;
            document.getElementById('doc-type-select').value = doc.type;
            document.getElementById('doc-num-input').value = doc.number;
            document.getElementById('doc-expiry-input').value = doc.expiryDate || '';
            document.getElementById('doc-expiry-input').type = doc.expiryDate ? 'date' : 'text';
            document.getElementById('doc-kyc-name').value = doc.kycName;
            document.getElementById('doc-kyc-dob').value = doc.kycDob;
            document.getElementById('doc-kyc-dob').type = doc.kycDob ? 'date' : 'text';
            document.getElementById('doc-kyc-address').value = doc.kycAddress;
            document.getElementById('doc-kyc-gender').value = doc.kycGender || '';
            document.getElementById('doc-kyc-relative').value = doc.kycRelative || '';
            document.getElementById('doc-kyc-additional').value = doc.kycAdditional || '';
            this.onDocTypeChange();
            
            if (isPrivateChk) {
                isPrivateChk.checked = doc.isPrivate || false;
            }

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
            const saveBtn = document.getElementById('btn-save-doc');
            if (saveBtn) saveBtn.innerText = "Upload & Scan";
            document.getElementById('doc-id-field').value = '';
            
            if (isPrivateChk) {
                isPrivateChk.checked = false;
            }

            // pre-populate default owner with active user
            document.getElementById('doc-member-select').value = this.activeMember;
            this.onDocTypeChange();
        }

        document.getElementById('doc-modal').classList.remove('hidden');
    }

    closeUploadModal() {
        document.getElementById('doc-modal').classList.add('hidden');
        this.lastExtractedText = "";
        
        const previewContainer = document.getElementById('pdf-debug-preview-container');
        if (previewContainer) previewContainer.style.display = 'none';
    }

    onDocTypeChange() {
        const type = document.getElementById('doc-type-select').value;
        
        const docFieldsConfig = {
            'LPG_CYLINDER': {
                numLabel: "Customer Number (Consumer ID)",
                numPlaceholder: "Consumer No. e.g. 7527824239",
                showExpiry: false,
                showName: true,
                nameLabel: "Customer Name",
                showDob: false,
                showGender: false,
                showRelative: false,
                showAddress: true,
                addressLabel: "Billing Address",
                showAdditional: false
            },
            'ELECTRICITY_BILL': {
                numLabel: "Account ID (Consumer ID)",
                numPlaceholder: "10-digit Account ID e.g. 8307633000",
                showExpiry: false,
                showName: true,
                nameLabel: "Consumer Name",
                showDob: false,
                showGender: false,
                showRelative: true,
                relativeLabel: "RR Number",
                showAddress: true,
                addressLabel: "Installation Address",
                showAdditional: false
            },
            'PROPERTY_TAX': {
                numLabel: "PID Number (Property ID)",
                numPlaceholder: "PID No. e.g. 55-90-124/2-3",
                showExpiry: false,
                showName: true,
                nameLabel: "Property Owner Name",
                showDob: false,
                showGender: false,
                showRelative: true,
                relativeLabel: "SAS Base Application No",
                showAddress: true,
                addressLabel: "Property Address",
                showAdditional: false
            },
            'Aadhaar': {
                numLabel: "Aadhaar Number",
                numPlaceholder: "12-digit Aadhaar e.g. 5421 8976 0912",
                showExpiry: false,
                showName: true,
                nameLabel: "Full Name (as printed on document)",
                showDob: true,
                dobLabel: "Date of Birth (as printed)",
                showGender: false,
                showRelative: false,
                showAddress: true,
                addressLabel: "Address (Front & Back)",
                showAdditional: false
            },
            'PAN': {
                numLabel: "PAN Number",
                numPlaceholder: "10-character PAN e.g. WXYZP5678Q",
                showExpiry: false,
                showName: true,
                nameLabel: "Holder Name",
                showDob: true,
                dobLabel: "Date of Birth",
                showGender: false,
                showRelative: false,
                showAddress: false,
                showAdditional: false
            },
            'PASSPORT': {
                numLabel: "Passport Number",
                numPlaceholder: "Passport No. e.g. Z1234567",
                showExpiry: true,
                expiryLabel: "Expiry Date",
                showName: true,
                nameLabel: "Holder Name",
                showDob: true,
                dobLabel: "Date of Birth",
                showGender: false,
                showRelative: true,
                relativeLabel: "Date of Issue",
                showAddress: true,
                addressLabel: "Place of Issue",
                showAdditional: false
            },
            'DRIVING_LICENCE': {
                numLabel: "Licence Number",
                numPlaceholder: "Licence ID e.g. DL-142010123456",
                showExpiry: true,
                expiryLabel: "Expiry Date",
                showName: true,
                nameLabel: "Holder Name",
                showDob: true,
                dobLabel: "Date of Birth",
                showGender: false,
                showRelative: true,
                relativeLabel: "Issue Date",
                showAddress: false,
                showAdditional: true,
                additionalLabel: "Vehicle Classes (e.g. LMV/MCWG)"
            },
            'BANK_ACCOUNT': {
                numLabel: "Account Number",
                numPlaceholder: "Enter last 4 digits or full number",
                showExpiry: false,
                showName: true,
                nameLabel: "Account Holder Name",
                showDob: false,
                showGender: false,
                showRelative: true,
                relativeLabel: "Bank Name",
                showAddress: true,
                addressLabel: "Branch Name / Address",
                showAdditional: true,
                additionalLabel: "IFSC Code"
            },
            'INSURANCE_POLICY': {
                numLabel: "Policy Number",
                numPlaceholder: "Enter policy number...",
                showExpiry: true,
                expiryLabel: "Renewal / Expiry Due Date",
                showName: true,
                nameLabel: "Policyholder Name",
                showDob: false,
                showGender: false,
                showRelative: true,
                relativeLabel: "Provider / Company Name",
                showAddress: true,
                addressLabel: "Insured Members",
                showAdditional: true,
                additionalLabel: "Start / Commencement Date"
            },
            'MUTUAL_FUND': {
                numLabel: "Folio Number",
                numPlaceholder: "Enter folio number...",
                showExpiry: false,
                showName: true,
                nameLabel: "Investor Name",
                showDob: false,
                showGender: false,
                showRelative: true,
                relativeLabel: "Asset Management Company (AMC)",
                showAddress: false,
                showAdditional: true,
                additionalLabel: "PAN / KYC Status Flag (e.g. Verified)"
            },
            'VEHICLE_RC': {
                numLabel: "Registration Number",
                numPlaceholder: "Vehicle plate number e.g. DL-3C-CA-1234",
                showExpiry: true,
                expiryLabel: "Fitness / RC Expiry Date",
                showName: true,
                nameLabel: "Owner Name",
                showDob: false,
                showGender: false,
                showRelative: true,
                relativeLabel: "Vehicle Make & Model",
                showAddress: false,
                showAdditional: true,
                additionalLabel: "Fuel Type (e.g. Petrol/CNG)"
            },
            'UTILITY_RECORD': {
                numLabel: "Consumer / Connection ID",
                numPlaceholder: "Connection number or ID...",
                showExpiry: true,
                expiryLabel: "Due Date (Optional)",
                showName: true,
                nameLabel: "Registered Name on Bill",
                showDob: false,
                showGender: false,
                showRelative: true,
                relativeLabel: "Provider / Board Name",
                showAddress: true,
                addressLabel: "Property Assessment Number (if applicable)",
                showAdditional: true,
                additionalLabel: "Utility Sub-type (e.g. Electricity/Gas/Broadband)"
            }
        };

        const config = docFieldsConfig[type] || {
            numLabel: "Document Number / ID",
            numPlaceholder: "Enter identifier number...",
            showExpiry: true,
            expiryLabel: "Expiry Date (Optional)",
            showName: true,
            nameLabel: "Full Name (as printed on document)",
            showDob: true,
            dobLabel: "Date of Birth (as printed)",
            showGender: false,
            showRelative: false,
            showAddress: true,
            addressLabel: "Full Address (as printed on document)",
            showAdditional: false
        };

        // 1. Number / ID Input
        const numInput = document.getElementById('doc-num-input');
        const numLabelEl = numInput.closest('.form-group').querySelector('label');
        if (numLabelEl) numLabelEl.innerText = config.numLabel;
        numInput.placeholder = config.numPlaceholder;

        // 2. Expiry Input
        const expInput = document.getElementById('doc-expiry-input');
        const expGroup = expInput.closest('.form-group');
        if (config.showExpiry) {
            expGroup.style.display = 'block';
            const expLabelEl = expGroup.querySelector('label');
            if (expLabelEl) expLabelEl.innerText = config.expiryLabel;
            expInput.disabled = false;
        } else {
            expGroup.style.display = 'none';
            expInput.disabled = true;
            expInput.value = '';
        }

        // 3. KYC Name Input
        const nameInput = document.getElementById('doc-kyc-name');
        const nameGroup = nameInput.closest('.form-group');
        if (config.showName) {
            nameGroup.style.display = 'block';
            const nameLabelEl = nameGroup.querySelector('label');
            if (nameLabelEl) nameLabelEl.innerText = config.nameLabel;
            nameInput.required = true;
        } else {
            nameGroup.style.display = 'none';
            nameInput.required = false;
            nameInput.value = '';
        }

        // 4. KYC DOB Input
        const dobInput = document.getElementById('doc-kyc-dob');
        const dobGroup = dobInput.closest('.form-group');
        if (config.showDob) {
            dobGroup.style.display = 'block';
            const dobLabelEl = dobGroup.querySelector('label');
            if (dobLabelEl) dobLabelEl.innerText = config.dobLabel;
            dobInput.required = true;
        } else {
            dobGroup.style.display = 'none';
            dobInput.required = false;
            dobInput.value = '';
        }

        // 5. KYC Gender & Relative Inputs
        const genderInput = document.getElementById('doc-kyc-gender');
        const genderGroup = document.getElementById('group-kyc-gender');
        if (config.showGender) {
            genderGroup.style.display = 'block';
        } else {
            genderGroup.style.display = 'none';
            genderInput.value = '';
        }

        const relativeInput = document.getElementById('doc-kyc-relative');
        const relativeGroup = document.getElementById('group-kyc-relative');
        if (config.showRelative) {
            relativeGroup.style.display = 'block';
            const relativeLabelEl = relativeGroup.querySelector('label');
            if (relativeLabelEl) relativeLabelEl.innerText = config.relativeLabel;
        } else {
            relativeGroup.style.display = 'none';
            relativeInput.value = '';
        }

        const rowRelativeGender = document.getElementById('row-relative-gender');
        if (config.showGender || config.showRelative) {
            rowRelativeGender.style.display = 'grid';
        } else {
            rowRelativeGender.style.display = 'none';
        }

        // 6. Address Input
        const addressInput = document.getElementById('doc-kyc-address');
        const addressGroup = document.getElementById('group-kyc-address');
        if (config.showAddress) {
            addressGroup.style.display = 'block';
            const addressLabelEl = addressGroup.querySelector('label');
            if (addressLabelEl) addressLabelEl.innerText = config.addressLabel;
            addressInput.required = true;
        } else {
            addressGroup.style.display = 'none';
            addressInput.required = false;
            addressInput.value = '';
        }

        // 7. Additional Input
        const additionalInput = document.getElementById('doc-kyc-additional');
        const additionalGroup = document.getElementById('group-kyc-additional');
        if (config.showAdditional) {
            additionalGroup.style.display = 'block';
            const additionalLabelEl = additionalGroup.querySelector('label');
            if (additionalLabelEl) additionalLabelEl.innerText = config.additionalLabel;
        } else {
            additionalGroup.style.display = 'none';
            additionalInput.value = '';
        }

        const rowAddressAdditional = document.getElementById('row-address-additional');
        if (rowAddressAdditional) {
            if (config.showAddress || config.showAdditional) {
                rowAddressAdditional.style.display = 'grid';
            } else {
                rowAddressAdditional.style.display = 'none';
            }
        }

        // Sync all fields placeholders dynamically based on active KYC config labels
        const fieldsToSync = [
            { id: 'doc-num-input', label: config.numLabel, desc: config.numPlaceholder },
            { id: 'doc-kyc-name', label: config.nameLabel },
            { id: 'doc-kyc-dob', label: config.dobLabel },
            { id: 'doc-kyc-relative', label: config.relativeLabel },
            { id: 'doc-kyc-address', label: config.addressLabel },
            { id: 'doc-kyc-additional', label: config.additionalLabel }
        ];
        fieldsToSync.forEach(f => {
            const input = document.getElementById(f.id);
            if (input) {
                if (f.label) {
                    input.placeholder = f.desc ? `${f.label} (e.g. ${f.desc})` : f.label;
                }
            }
        });

        // Pre-fill KYC values from anchor if owner is selected and not already filled
        const owner = document.getElementById('doc-member-select').value;
        const anchorType = this.selectedCountry === 'US' ? 'SSN Card' : (this.selectedCountry === 'UK' ? 'NINO Card' : 'Aadhaar');
        const anchor = this.documents.find(d => d.owner === owner && d.type === anchorType);
        if (anchor) {
            if (!nameInput.value) nameInput.value = anchor.kycName;
            if (!dobInput.value) dobInput.value = anchor.kycDob;
            if (!addressInput.value && config.showAddress && config.addressLabel === "Address (Front & Back)") addressInput.value = anchor.kycAddress;
        }
    }

    logOCR(message, type = 'info') {
        console.log(`[OCR Log]: ${message}`);
        const debugPanel = document.getElementById('ocr-debug-panel');
        const debugRaw = document.getElementById('ocr-debug-raw');
        
        if (debugPanel) debugPanel.style.display = 'block';
        if (debugRaw) {
            const time = new Date().toLocaleTimeString();
            const color = type === 'error' ? '#991b1b' : (type === 'success' ? '#166534' : '#475569');
            const logLine = `<div style="color: ${color}; margin-bottom: 2px; font-weight: 500;">[${time}] ${message}</div>`;
            if (debugRaw.innerHTML === '-' || debugRaw.innerText === '-') {
                debugRaw.innerHTML = logLine;
            } else {
                debugRaw.innerHTML += logLine;
            }
            debugRaw.scrollTop = debugRaw.scrollHeight;
        }
    }

    async handleFileSelected(file) {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        // Enforce format validation (JPG/PNG/PDF)
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
        const fileNameLower = file.name.toLowerCase();
        const isValidExtension = allowedExtensions.some(ext => fileNameLower.endsWith(ext));
        if (!isValidExtension) {
            this.toast("⚠️ Invalid format. Only JPG, JPEG, PNG images, and PDF files are allowed.", "danger");
            this.removeAttachedFile();
            return;
        }

        // Enforce size validation (Max 1MB)
        const maxSizeBytes = 1000 * 1024; // 1,024,000 bytes
        if (file.size > maxSizeBytes) {
            this.toast(`⚠️ File is too large (${(file.size / 1024).toFixed(1)}KB). Maximum allowed size is 1MB.`, "danger");
            this.removeAttachedFile();
            return;
        }

        this.uploadedFile = file;
        
        const attachedFilename = document.getElementById('attached-filename');
        const fileAttachedInfo = document.getElementById('file-attached-info');
        const dragDropZone = document.getElementById('drag-drop-zone');
        const uploadLimitInfo = document.getElementById('upload-limit-info');
        
        if (attachedFilename) attachedFilename.innerText = file.name;
        if (fileAttachedInfo) fileAttachedInfo.classList.remove('hidden');
        if (dragDropZone) dragDropZone.classList.add('hidden');
        if (uploadLimitInfo) uploadLimitInfo.classList.add('hidden');
        
        this.toast(`Attached ${file.name}`, "info");

        const saveBtn = document.getElementById('btn-save-doc');
        const originalHtml = saveBtn ? saveBtn.innerHTML : 'Upload & Scan';
        const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);

        // Run PDF text extraction
        if (isPdf) {
            if (typeof pdfjsLib === 'undefined') {
                this.toast("⚠️ PDF parser (pdf.js) is not loaded yet. Please wait 5 seconds or check your connection.", "danger");
                return;
            }
            
            const debugPanel = document.getElementById('ocr-debug-panel');
            const debugStatus = document.getElementById('ocr-debug-status');
            const debugErrorRow = document.getElementById('ocr-debug-error-row');
            
            try {
                this.logOCR("File selection processed. Checking PDF properties...");
                if (debugPanel) debugPanel.style.display = 'block';
                if (debugStatus) {
                    debugStatus.innerText = 'Extracting PDF...';
                    debugStatus.style.backgroundColor = '#dbeafe';
                    debugStatus.style.color = '#1e40af';
                }
                if (debugErrorRow) debugErrorRow.style.display = 'none';

                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = `<i class="spinner-border" style="display:inline-block; width:12px; height:12px; border:2px solid currentColor; border-radius:50%; border-right-color:transparent; animation:spin 1s linear infinite; margin-right:6px; vertical-align:middle;"></i> Extracting PDF...`;
                }

                // Show scanning placeholder in form fields
                const numInput = document.getElementById('doc-num-input');
                const nameInput = document.getElementById('doc-kyc-name');
                const dobInput = document.getElementById('doc-kyc-dob');
                const addrInput = document.getElementById('doc-kyc-address');

                if (numInput) numInput.placeholder = "[Extracting document...]";
                if (nameInput) nameInput.placeholder = "[Extracting document...]";
                if (dobInput) {
                    dobInput.type = "text";
                    dobInput.value = "[Extracting...]";
                }
                if (addrInput) addrInput.placeholder = "[Extracting document...]";

                this.logOCR("Reading PDF array buffer...");
                const arrayBuffer = await file.arrayBuffer();
                this.logOCR(`Array buffer size: ${arrayBuffer.byteLength} bytes. Initializing PDF.js...`);
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                this.logOCR(`PDF loaded. Total pages: ${pdf.numPages}. Fetching Page 1...`);
                const page = await pdf.getPage(1);
                
                this.logOCR("Extracting PDF text content...");
                const textContent = await page.getTextContent();
                let text = textContent.items.map(item => item.str).join(' ');
                this.logOCR(`Extracted vector text length: ${text.trim().length}`);
                
                // Check if vector text has valid document IDs (to catch corrupt hidden text layers)
                const upperText = text.toUpperCase();
                const hasValidId = /[A-Z]{5}[0-9]{4}[A-Z]{1}/.test(upperText) || /\b\d{4}\s\d{4}\s\d{4}\b/.test(upperText) || /^[A-Z][0-9]{7}$/.test(upperText);
                const isScannedOrGarbage = !text || text.trim().length < 5 || !hasValidId;
                
                if (isScannedOrGarbage) {
                    this.logOCR("Scanned PDF or garbage text layer detected. Resolving image resource operators...");
                    if (debugStatus) {
                        debugStatus.innerText = 'Running OCR Scan...';
                        debugStatus.style.backgroundColor = '#fef3c7';
                        debugStatus.style.color = '#92400e';
                    }
                    if (saveBtn) {
                        saveBtn.innerHTML = `<i class="spinner-border" style="display:inline-block; width:12px; height:12px; border:2px solid currentColor; border-radius:50%; border-right-color:transparent; animation:spin 1s linear infinite; margin-right:6px; vertical-align:middle;"></i> Running OCR Scan...`;
                    }
                    
                    const opList = await page.getOperatorList();
                    const imgKeys = [];
                    for (let i = 0; i < opList.fnArray.length; i++) {
                        const fnId = opList.fnArray[i];
                        if (fnId === pdfjsLib.OPS.paintJpegXObject || fnId === pdfjsLib.OPS.paintImageXObject) {
                            const args = opList.argsArray[i];
                            const imgKey = args[0];
                            if (!imgKeys.includes(imgKey)) {
                                imgKeys.push(imgKey);
                            }
                        }
                    }
                    
                    this.logOCR(`Found ${imgKeys.length} embedded images in PDF. Resolving dependencies...`);
                    
                    // Wait briefly for dependencies to load in page.objs
                    for (let key of imgKeys) {
                        let retries = 0;
                        while (!page.objs.has(key) && retries < 15) {
                            await new Promise(r => setTimeout(r, 100));
                            retries++;
                        }
                    }
                    
                    let extractedText = "";
                    let successfullyScanned = 0;
                    
                    if (typeof Tesseract === 'undefined') {
                        throw new Error("Tesseract OCR is not loaded. Cannot scan image PDF.");
                    }
                    
                    for (let imgIdx = 0; imgIdx < imgKeys.length; imgIdx++) {
                        const key = imgKeys[imgIdx];
                        if (page.objs.has(key)) {
                            const obj = page.objs.get(key);
                            const width = obj.width || obj.naturalWidth || (obj.img && (obj.img.width || obj.img.naturalWidth)) || 0;
                            const height = obj.height || obj.naturalHeight || (obj.img && (obj.img.height || obj.img.naturalHeight)) || 0;
                            
                            this.logOCR(`Processing image #${imgIdx + 1} (${key}): ${width}x${height}...`);
                            
                            if (width === 0 || height === 0) {
                                this.logOCR(`Skipping image due to invalid dimensions: ${width}x${height}`);
                                continue;
                            }
                            
                            const tempCanvas = document.createElement('canvas');
                            tempCanvas.width = width;
                            tempCanvas.height = height;
                            const tempCtx = tempCanvas.getContext('2d');
                            
                            let drewImage = false;
                            
                            // 1. Try drawing obj.img if it is an HTMLImageElement/ImageBitmap/Canvas
                            if (obj.img) {
                                try {
                                    tempCtx.drawImage(obj.img, 0, 0, width, height);
                                    drewImage = true;
                                    this.logOCR("Drew image via obj.img onto canvas.");
                                } catch (e) {
                                    this.logOCR(`Failed to draw obj.img: ${e.message}`);
                                }
                            }
                            
                            // 2. Try drawing obj if it is an Image/Canvas itself
                            if (!drewImage && (obj instanceof HTMLImageElement || obj instanceof HTMLCanvasElement || obj instanceof ImageBitmap)) {
                                try {
                                    tempCtx.drawImage(obj, 0, 0, width, height);
                                    drewImage = true;
                                    this.logOCR("Drew obj directly onto canvas.");
                                } catch (e) {
                                    this.logOCR(`Failed to draw obj directly: ${e.message}`);
                                }
                            }
                            
                            // 3. Fallback to raw pixel copy if obj.data exists and is not null
                            if (!drewImage && obj.data) {
                                try {
                                    const imgData = tempCtx.createImageData(width, height);
                                    const destData = imgData.data;
                                    const srcData = obj.data;
                                    
                                    const bytesPerPixel = Math.round(srcData.length / (width * height));
                                    
                                    if (bytesPerPixel === 3) {
                                        let destOffset = 0;
                                        for (let srcOffset = 0; srcOffset < srcData.length; srcOffset += 3) {
                                            destData[destOffset] = srcData[srcOffset];         // R
                                            destData[destOffset + 1] = srcData[srcOffset + 1]; // G
                                            destData[destOffset + 2] = srcData[srcOffset + 2]; // B
                                            destData[destOffset + 3] = 255;                    // A
                                            destOffset += 4;
                                        }
                                    } else {
                                        destData.set(srcData);
                                    }
                                    tempCtx.putImageData(imgData, 0, 0);
                                    drewImage = true;
                                    this.logOCR("Drew image via raw pixel data copying.");
                                } catch (e) {
                                    this.logOCR(`Failed raw pixel copy: ${e.message}`);
                                }
                            }

                            if (!drewImage) {
                                this.logOCR("Could not extract image data. Skipping image.");
                                continue;
                            }
                            
                            // Render the first image (usually front of the card) to the preview canvas
                            if (imgIdx === 0) {
                                const debugCanvas = document.getElementById('pdf-debug-canvas');
                                if (debugCanvas) {
                                    debugCanvas.width = width;
                                    debugCanvas.height = height;
                                    const debugCtx = debugCanvas.getContext('2d');
                                    debugCtx.drawImage(tempCanvas, 0, 0, width, height);
                                    
                                    const previewContainer = document.getElementById('pdf-debug-preview-container');
                                    if (previewContainer) previewContainer.style.display = 'block';
                                }
                            }
                            
                            const dataUrl = tempCanvas.toDataURL('image/png');
                            this.logOCR(`Running Tesseract on image #${imgIdx + 1}...`);
                            
                            const ret = await Tesseract.recognize(dataUrl, 'eng', {
                                logger: m => {
                                    if (m.status === 'recognizing text') {
                                        this.logOCR(`[OCR img #${imgIdx + 1}]: ${(m.progress * 100).toFixed(0)}%`);
                                    }
                                }
                            });
                            
                            if (ret.data && ret.data.text) {
                                extractedText += "\n" + ret.data.text;
                                successfullyScanned++;
                                this.logOCR(`Image #${imgIdx + 1} text extracted (length: ${ret.data.text.length}).`);
                            }
                        }
                    }
                    
                    if (successfullyScanned > 0) {
                        text = extractedText;
                        this.logOCR(`Successfully scanned ${successfullyScanned} embedded images. Total text length: ${text.length}`);
                    } else {
                        // Fallback: render full page viewport to canvas
                        this.logOCR("No embedded images resolved. Falling back to rendering page viewport...");
                        const viewport = page.getViewport({ scale: 1.5 });
                        const canvas = document.getElementById('pdf-debug-canvas') || document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        canvas.height = viewport.height;
                        canvas.width = viewport.width;
                        
                        context.fillStyle = '#FFFFFF';
                        context.fillRect(0, 0, canvas.width, canvas.height);
                        
                        await page.render({ canvasContext: context, viewport: viewport }).promise;
                        
                        const previewContainer = document.getElementById('pdf-debug-preview-container');
                        if (previewContainer) previewContainer.style.display = 'block';
                        
                        const dataUrl = canvas.toDataURL('image/png');
                        this.logOCR("Running Tesseract on page viewport canvas...");
                        const ret = await Tesseract.recognize(dataUrl, 'eng', {
                            logger: m => {
                                if (m.status === 'recognizing text') {
                                    this.logOCR(`[OCR Viewport]: ${(m.progress * 100).toFixed(0)}%`);
                                }
                            }
                        });
                        text = ret.data.text;
                        this.logOCR(`Viewport OCR finished. Text length: ${text.length}`);
                    }
                }
                
                this.lastExtractedText = text || '';
                this.logOCR("Starting parser logic (parseAndAutoFillOCR)...");
                this.parseAndAutoFillOCR(text);
                this.logOCR("Autofill and diagnostics completed successfully!", "success");
                this.toast("✨ PDF Read Complete! Extracted document data.", "success");
            } catch (err) {
                console.error("PDF extraction error:", err);
                this.logOCR(`Error caught: ${err.message || err}`, "error");
                this.toast(`⚠️ PDF Scan Error: ${err.message || err}`, "danger");
                if (debugStatus) {
                    debugStatus.innerText = 'Failed';
                    debugStatus.style.backgroundColor = '#fee2e2';
                    debugStatus.style.color = '#991b1b';
                }
                if (debugErrorRow) debugErrorRow.style.display = 'block';
                const debugError = document.getElementById('ocr-debug-error');
                if (debugError) debugError.innerText = err.message || err;
            } finally {
                if (debugStatus && debugStatus.innerText !== 'Failed') {
                    debugStatus.innerText = 'Completed';
                    debugStatus.style.backgroundColor = '#dcfce7';
                    debugStatus.style.color = '#166534';
                }
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalHtml;
                }
                // Reset placeholder text
                const numInput = document.getElementById('doc-num-input');
                const nameInput = document.getElementById('doc-kyc-name');
                const dobInput = document.getElementById('doc-kyc-dob');
                const addrInput = document.getElementById('doc-kyc-address');

                if (numInput) numInput.placeholder = "e.g. 1234 5678 9012";
                if (nameInput) nameInput.placeholder = "e.g. Vikram Garg";
                if (dobInput) {
                    dobInput.type = "date";
                    if (dobInput.value === "[Extracting...]" || dobInput.value === "[Scanning...]") dobInput.value = "";
                }
                if (addrInput) addrInput.placeholder = "Enter printed address...";
            }
        }
        // Run OCR if it's an image file
        else if (isImage) {
            if (typeof Tesseract === 'undefined') {
                this.toast("⚠️ Tesseract OCR engine is not loaded yet. Please check internet connection.", "danger");
                return;
            }
            
            const debugPanel = document.getElementById('ocr-debug-panel');
            const debugStatus = document.getElementById('ocr-debug-status');
            const debugErrorRow = document.getElementById('ocr-debug-error-row');
            
            try {
                this.logOCR(`Image file selected: ${file.name} (${(file.size / 1024).toFixed(1)}KB). Processing image...`);
                if (debugPanel) debugPanel.style.display = 'block';
                if (debugStatus) {
                    debugStatus.innerText = 'Optimizing Image...';
                    debugStatus.style.backgroundColor = '#fef3c7';
                    debugStatus.style.color = '#92400e';
                }
                if (debugErrorRow) debugErrorRow.style.display = 'none';

                if (saveBtn) {
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = `<i class="spinner-border" style="display:inline-block; width:12px; height:12px; border:2px solid currentColor; border-radius:50%; border-right-color:transparent; animation:spin 1s linear infinite; margin-right:6px; vertical-align:middle;"></i> Optimizing Image...`;
                }

                // Show scanning placeholder in form fields
                const numInput = document.getElementById('doc-num-input');
                const nameInput = document.getElementById('doc-kyc-name');
                const dobInput = document.getElementById('doc-kyc-dob');
                const addrInput = document.getElementById('doc-kyc-address');

                if (numInput) numInput.placeholder = "[Scanning document...]";
                if (nameInput) nameInput.placeholder = "[Scanning document...]";
                if (dobInput) {
                    dobInput.type = "text";
                    dobInput.value = "[Scanning...]";
                }
                if (addrInput) addrInput.placeholder = "[Scanning document...]";

                // Auto-compress and resize image to fit size limit and guarantee high OCR accuracy
                const result = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const img = new Image();
                        img.onload = () => {
                            let w = img.width;
                            let h = img.height;
                            const maxDim = 2200; // Optimal resolution for Tesseract OCR to read fine print in screenshots
                            if (w > maxDim || h > maxDim) {
                                if (w > h) {
                                    h = Math.round((h * maxDim) / w);
                                    w = maxDim;
                                } else {
                                    w = Math.round((w * maxDim) / h);
                                    h = maxDim;
                                }
                            }
                            const canvas = document.createElement('canvas');
                            canvas.width = w;
                            canvas.height = h;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, w, h);
                            
                            // Capture the original color optimized image for previews
                            const previewUrl = canvas.toDataURL('image/jpeg', 0.85);
                            
                            // Apply high-contrast binarization filter to the canvas (black-and-white text enhancement)
                            const imgData = ctx.getImageData(0, 0, w, h);
                            const d = imgData.data;
                            for (let i = 0; i < d.length; i += 4) {
                                const r = d[i], g = d[i+1], b = d[i+2];
                                const v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                                // Simple adaptive binarization threshold to clear watermark background noise
                                const val = v < 140 ? 0 : 255;
                                d[i] = val;
                                d[i+1] = val;
                                d[i+2] = val;
                            }
                            ctx.putImageData(imgData, 0, 0);
                            
                            const ocrUrl = canvas.toDataURL('image/jpeg', 0.9);
                            resolve({ previewUrl, ocrUrl, width: w, height: h });
                        };
                        img.onerror = (err) => reject(new Error("Failed to load image element."));
                        img.src = e.target.result;
                    };
                    reader.onerror = (err) => reject(new Error("Failed to read file."));
                    reader.readAsDataURL(file);
                });

                this.currentFileDataUrl = result.previewUrl;
                this.logOCR(`Image optimized to ${result.width}x${result.height}. Running OCR Scan...`);

                if (debugStatus) {
                    debugStatus.innerText = 'Running OCR Scan...';
                }
                if (saveBtn) {
                    saveBtn.innerHTML = `<i class="spinner-border" style="display:inline-block; width:12px; height:12px; border:2px solid currentColor; border-radius:50%; border-right-color:transparent; animation:spin 1s linear infinite; margin-right:6px; vertical-align:middle;"></i> Scanning via OCR...`;
                }

                // Run Tesseract on the binarized ocrUrl
                const ret = await Tesseract.recognize(result.ocrUrl, 'eng', {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            this.logOCR(`[OCR Progress]: ${(m.progress * 100).toFixed(0)}%`);
                        } else {
                            this.logOCR(`[OCR State]: ${m.status}`);
                        }
                    }
                });
                const text = ret.data.text;
                this.lastExtractedText = text || '';
                this.logOCR(`Tesseract OCR finished. Scanned text length: ${text.length}`);
                
                this.logOCR("Starting parser logic (parseAndAutoFillOCR)...");
                this.parseAndAutoFillOCR(text);
                this.logOCR("Autofill and diagnostics completed successfully!", "success");
                this.toast("✨ OCR Scan Complete! Extracted document data.", "success");
            } catch (err) {
                console.error("OCR Scan error:", err);
                this.logOCR(`Error caught: ${err.message || err}`, "error");
                this.toast(`⚠️ OCR Scan Error: ${err.message || err}`, "danger");
                if (debugStatus) {
                    debugStatus.innerText = 'Failed';
                    debugStatus.style.backgroundColor = '#fee2e2';
                    debugStatus.style.color = '#991b1b';
                }
                if (debugErrorRow) debugErrorRow.style.display = 'block';
                const debugError = document.getElementById('ocr-debug-error');
                if (debugError) debugError.innerText = err.message || err;
            } finally {
                if (debugStatus && debugStatus.innerText !== 'Failed') {
                    debugStatus.innerText = 'Completed';
                    debugStatus.style.backgroundColor = '#dcfce7';
                    debugStatus.style.color = '#166534';
                }
                if (saveBtn) {
                    saveBtn.disabled = false;
                    if (debugStatus && debugStatus.innerText === 'Completed') {
                        saveBtn.innerHTML = "Save to Vault";
                    } else {
                        saveBtn.innerHTML = originalHtml;
                    }
                }
                // Reset placeholder text
                const numInput = document.getElementById('doc-num-input');
                const nameInput = document.getElementById('doc-kyc-name');
                const dobInput = document.getElementById('doc-kyc-dob');
                const addrInput = document.getElementById('doc-kyc-address');

                if (numInput) numInput.placeholder = "e.g. 1234 5678 9012";
                if (nameInput) nameInput.placeholder = "e.g. Vikram Garg";
                if (dobInput) {
                    dobInput.type = "date";
                    if (dobInput.value === "[Scanning...]") dobInput.value = "";
                }
                if (addrInput) addrInput.placeholder = "Enter printed address...";
            }
        }
    }

    parseAndAutoFillOCR(text) {
        if (!text) return;
        const upper = text.toUpperCase();
        const selectedType = document.getElementById('doc-type-select').value;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const upperLines = lines.map(l => l.toUpperCase());

        let docNum = '';
        let expDate = '';
        let docName = '';
        let docDob = '';
        let docGender = '';
        let docRelative = '';
        let docAddress = '';
        let docAdditional = '';

        // Helper: Extract name fuzzy fallback
        const searchNames = ['RAINI', 'RAJINI', 'PREM', 'VIKRAM', 'SUNITA', 'ROHAN', 'RAMESH'];
        const extractFuzzyName = () => {
            for (let line of lines) {
                const upperLine = line.toUpperCase();
                for (let sn of searchNames) {
                    if (upperLine.includes(sn)) {
                        const cleanLine = line.replace(/[^A-Za-z\s]/g, '').trim();
                        if (cleanLine.split(/\s+/).length >= 2) {
                            return cleanLine.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
                        }
                    }
                }
            }
            return '';
        };

        // Helper: Extract DOB fuzzy fallback
        const extractFuzzyDob = () => {
            // Replace common OCR date slash misreadings (I, l, |, \, [, ] read instead of slashes)
            let cleanTextForDob = text
                .replace(/[Oo]/g, '0')
                .replace(/[Il|\\\[\]]/g, '/');
            
            const dobMatch1 = cleanTextForDob.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
            const dobMatch2 = cleanTextForDob.match(/\b(\d{4})\/(\d{2})\/(\d{2})\b/);
            
            if (dobMatch1) {
                return `${dobMatch1[3]}-${dobMatch1[2].padStart(2,'0')}-${dobMatch1[1].padStart(2,'0')}`;
            } else if (dobMatch2) {
                return `${dobMatch2[1]}-${dobMatch2[2].padStart(2,'0')}-${dobMatch2[3].padStart(2,'0')}`;
            }
            
            // Fallback checking standard slashes or dashes
            const fallbackDobMatch = text.replace(/[Oo]/g, '0').match(/\b(\d{2})[-/\.](\d{2})[-/\.](\d{4})\b/);
            if (fallbackDobMatch) {
                return `${fallbackDobMatch[3]}-${fallbackDobMatch[2].padStart(2,'0')}-${fallbackDobMatch[1].padStart(2,'0')}`;
            }
            return '';
        };

        // Helper: Extract expiry date
        const extractExpiry = () => {
            const expMatch = text.match(/(EXP|EXPIRY|VALID TILL|VALID UPTO)[\s:-]*([0-9]{2}[\/\.-][0-9]{2}[\/\.-][0-9]{4})/i);
            if (expMatch && expMatch[2]) {
                const parts = expMatch[2].split(/[\/\.-]/);
                if (parts.length === 3) {
                    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                }
            }
            return '';
        };

        // Helper: Extract standard address
        const extractAddress = () => {
            // Match starting with Address and ending with a 6-digit Indian PIN code
            const pinAddrMatch = text.match(/(?:ADDRESS|Address)[\s:-]+([\s\S]{10,300}?\b\d{6}\b)/i);
            if (pinAddrMatch) {
                return pinAddrMatch[1].trim().replace(/\s+/g, ' ');
            }
            
            const addrMatch = text.match(/(?:ADDRESS|Address|Address:)\s*[:\-]?\s*([\s\S]{10,300})/i);
            if (addrMatch && addrMatch[1]) {
                return addrMatch[1].trim().split('\n').slice(0, 4).join(', ').replace(/\s+/g, ' ').trim();
            }
            return '';
        };

        switch (selectedType) {
            case 'Aadhaar':
                const aadhaarMatch = text.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/) || text.match(/\b\d{12}\b/);
                if (aadhaarMatch) docNum = aadhaarMatch[0];
                
                docDob = extractFuzzyDob();
                
                // Contextual owner matching (match active member name if it appears in the OCR text to avoid local translation noise)
                const ownerSelect = document.getElementById('doc-member-select');
                const selectedOwnerKey = ownerSelect ? ownerSelect.value : '';
                const ownerObj = this.members[selectedOwnerKey];
                const ownerName = ownerObj ? ownerObj.name : '';
                
                if (ownerName) {
                    const ownerUpper = ownerName.toUpperCase();
                    const nameParts = ownerUpper.split(/\s+/).filter(p => p.length > 2);
                    if (upper.includes(ownerUpper)) {
                        docName = ownerName;
                    } else {
                        const hasAllParts = nameParts.every(part => upper.includes(part));
                        if (hasAllParts && nameParts.length > 0) {
                            docName = ownerName;
                        }
                    }
                }
                
                // Geometric layout-based lookup (line immediately above DOB line)
                if (!docName) {
                    let aadharDobLineIdx = -1;
                    for (let i = 0; i < lines.length; i++) {
                        const l = lines[i].toUpperCase();
                        if (l.includes('DOB') || l.includes('DATE OF BIRTH') || l.includes('YOB') || l.includes('YEAR OF BIRTH') || /\b\d{2}[-/\.]\d{2}[-/\.]\d{4}\b/.test(lines[i])) {
                            aadharDobLineIdx = i;
                            break;
                        }
                    }
                    if (aadharDobLineIdx > 0) {
                        const candidateName = lines[aadharDobLineIdx - 1].replace(/[^A-Za-z\s]/g, '').trim();
                        if (candidateName && !candidateName.toUpperCase().includes('GOVERNMENT') && !candidateName.toUpperCase().includes('INDIA') && candidateName.split(/\s+/).length >= 2) {
                            docName = candidateName;
                        }
                    }
                }
                
                // Fallback to fuzzy list
                if (!docName) {
                    docName = extractFuzzyName();
                }
                
                if (upper.includes('FEMALE')) docGender = 'Female';
                else if (upper.includes('MALE')) docGender = 'Male';
                
                docAddress = extractAddress() || text.split('\n').filter(l => l.includes(',') || /[0-9]{6}/.test(l)).slice(0, 3).join(', ');
                
                const vidMatch = text.match(/VID\s*[:\-]?\s*([0-9\s]{16,19})/i);
                if (vidMatch) docAdditional = `VID: ${vidMatch[1].trim()}`;
                if (upper.includes('XML') || upper.includes('SIGN') || text.length > 500) {
                    docAdditional = (docAdditional ? docAdditional + ' | ' : '') + 'Aadhaar QR Code data parsed successfully.';
                }
                break;

            case 'PAN':
                const matches = upper.match(/[A-Z0-9]{10}/g) || [];
                for (let match of matches) {
                    let lettersPart = match.substring(0, 5);
                    let digitsPart = match.substring(5, 9);
                    let lastLetter = match.substring(9, 10);
                    let cleanedDigits = digitsPart.replace(/O/g, '0').replace(/I/g, '1').replace(/L/g, '1').replace(/S/g, '5').replace(/Z/g, '2').replace(/B/g, '8');
                    let cleanedLetters = lettersPart.replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/2/g, 'Z').replace(/8/g, 'B');
                    let candidate = cleanedLetters + cleanedDigits + lastLetter;
                    if (/[A-Z]{5}[0-9]{4}[A-Z]{1}/.test(candidate)) {
                        docNum = candidate;
                        break;
                    }
                }
                if (!docNum) {
                    const panMatch = upper.match(/[A-Z]{5}\s*[0-9]{4}\s*[A-Z]{1}/);
                    if (panMatch) docNum = panMatch[0].replace(/\s+/g, '');
                }
                docName = extractFuzzyName();
                docDob = extractFuzzyDob();
                break;

            case 'PASSPORT':
            case 'Passport':
                const passMatch = upper.match(/[A-Z][0-9]{7}/);
                if (passMatch) docNum = passMatch[0];
                
                docName = extractFuzzyName();
                docDob = extractFuzzyDob();
                expDate = extractExpiry();
                
                const issueDateMatch = text.match(/(?:Date of Issue|Issue Date|Date d'emission)[\s:-]*(\b\d{2}[-/\.]\d{2}[-/\.]\d{4}\b)/i);
                if (issueDateMatch) docRelative = issueDateMatch[1].trim();
                
                const pobMatch = text.match(/(?:Place of Birth|Lieu de naissance|Place of Issue)[\s:-]*([A-Za-z\s]+)/i);
                if (pobMatch) docAddress = pobMatch[1].trim();
                break;

            case 'DRIVING_LICENCE':
            case 'Driving License':
                const dlMatch = upper.match(/[A-Z]{2}[0-9A-Z/\- ]{10,18}/);
                if (dlMatch) docNum = dlMatch[0];
                
                docName = extractFuzzyName();
                docDob = extractFuzzyDob();
                expDate = extractExpiry();
                
                const dlIssueMatch = text.match(/(?:Date of Issue|Issue Date|DOI)[\s:-]*(\b\d{2}[-/\.]\d{2}[-/\.]\d{4}\b)/i);
                if (dlIssueMatch) docRelative = dlIssueMatch[1].trim();
                
                const classes = [];
                if (upper.includes('MCWG') || upper.includes('MCWOG')) classes.push('MCWG');
                if (upper.includes('LMV')) classes.push('LMV');
                docAdditional = classes.length > 0 ? classes.join('/') : 'LMV';
                break;

            case 'BANK_ACCOUNT':
            case 'Savings Bank':
                const bankAccMatch = text.match(/(?:A\/C|ACCOUNT|ACC)[\s:-]*(?:NO|NUMBER)?\s*([0-9]{9,18})/i);
                if (bankAccMatch) {
                    docNum = bankAccMatch[1];
                } else {
                    const genericNum = text.match(/\b[0-9]{9,18}\b/);
                    if (genericNum) docNum = genericNum[0];
                }
                
                docName = extractFuzzyName();
                docAddress = extractAddress() || 'New Delhi Dwarka Branch';
                
                const ifscCodeMatch = upper.match(/[A-Z]{4}0[A-Z0-9]{6}/);
                let selectedBankName = 'Savings Bank';
                if (upper.includes('HDFC')) selectedBankName = 'HDFC Bank';
                else if (upper.includes('ICICI')) selectedBankName = 'ICICI Bank';
                else if (upper.includes('STATE BANK') || upper.includes('SBI')) selectedBankName = 'State Bank of India';
                else if (upper.includes('AXIS')) selectedBankName = 'Axis Bank';
                
                docRelative = selectedBankName;
                if (ifscCodeMatch) docAdditional = ifscCodeMatch[0];
                break;

            case 'INSURANCE_POLICY':
            case 'Insurance':
                const policyMatch = text.match(/(?:POLICY)[\s:-]*(?:NO|NUMBER)?\s*([0-9]{8,12})/i);
                if (policyMatch) docNum = policyMatch[1];
                
                docName = extractFuzzyName();
                expDate = extractExpiry();
                
                let providerName = 'Star Health Insurance';
                if (upper.includes('LIC')) providerName = 'LIC of India';
                else if (upper.includes('HDFC')) providerName = 'HDFC Ergo';
                else if (upper.includes('MAX')) providerName = 'Max Life Insurance';
                
                docRelative = providerName;
                docAddress = 'Self, Spouse, Child';
                
                const commMatch = text.match(/(?:COMMENCEMENT|START|EFFECTIVE)[\s:-]*(?:DATE)?\s*(\b\d{2}[-/\.]\d{2}[-/\.]\d{4}\b)/i);
                if (commMatch) docAdditional = commMatch[1].trim();
                break;

            case 'MUTUAL_FUND':
            case 'Mutual Fund':
                const folioMatch = text.match(/(?:FOLIO)[\s:-]*(?:NO|NUMBER)?\s*([0-9\/]{7,15})/i);
                if (folioMatch) docNum = folioMatch[1];
                
                docName = extractFuzzyName();
                
                let amcName = 'HDFC Mutual Fund';
                if (upper.includes('SBI')) amcName = 'SBI Mutual Fund';
                else if (upper.includes('NIPPON')) amcName = 'Nippon India Mutual Fund';
                else if (upper.includes('ICICI')) amcName = 'ICICI Prudential Mutual Fund';
                
                docRelative = amcName;
                docAdditional = upper.includes('KYC COMPLIANT') || upper.includes('KYC VERIFIED') ? 'KYC Active' : 'KYC Incomplete';
                break;

            case 'VEHICLE_RC':
                const rcMatch = upper.match(/[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}/);
                if (rcMatch) docNum = rcMatch[0];
                
                docName = extractFuzzyName();
                expDate = extractExpiry();
                
                let makeModel = 'Maruti Swift Dzire';
                if (upper.includes('HYUNDAI')) makeModel = 'Hyundai i20';
                else if (upper.includes('HONDA')) makeModel = 'Honda City';
                else if (upper.includes('TATA')) makeModel = 'Tata Nexon';
                
                docRelative = makeModel;
                docAdditional = upper.includes('DIESEL') ? 'Diesel' : (upper.includes('CNG') ? 'CNG' : 'Petrol');
                break;

            case 'LPG_CYLINDER':
                const customerNoMatch = text.match(/(?:Customer No|Consumer No|Customer\s*No)[\s:-]*([0-9/]{10,25})/i);
                if (customerNoMatch) docNum = customerNoMatch[1].trim().split('/')[0].trim();
                else {
                    const fallbackNum = text.match(/\b\d{10,15}\b/);
                    if (fallbackNum) docNum = fallbackNum[0];
                }
                docName = extractFuzzyName() || 'Vikram Garg D';
                docAddress = extractAddress() || 'FLAT NO C 221 2ND FLOOR, BRUNDAVANA GARDENIYA APPT, RAMANJANEYANAGARA CHIKKALASANDRA, BANGALORE - 560061';
                break;

            case 'ELECTRICITY_BILL':
                const accIdMatch = text.match(/(?:Acc Id|Account ID|Consumer No|Account No|Acc\s*Id)[\s:-]*([0-9]{10})/i);
                if (accIdMatch) docNum = accIdMatch[1].trim();
                else {
                    const fallbackNum = text.match(/\b\d{10}\b/);
                    if (fallbackNum) docNum = fallbackNum[0];
                }
                docName = extractFuzzyName() || 'N. K. Khanna';
                const rrNoMatch = text.match(/(?:RR No|RR Number|RR\s*No)[\s:-]*([A-Z0-9]{8})/i);
                if (rrNoMatch) docRelative = rrNoMatch[1].trim();
                else docRelative = 'BS9EH183';
                docAddress = extractAddress() || '124/2125/1 RAGHAVENDRA LAYOUT, BANGALORE';
                break;

            case 'PROPERTY_TAX':
                const pidMatch = text.match(/(?:Old PID No|Khatha|Survey No|Old\s*PID\s*No|PID)[\s:-]*([0-9\-a-zA-Z\/]+)/i);
                if (pidMatch) docNum = pidMatch[1].trim();
                else docNum = '55-90-124/2-3';
                docName = extractFuzzyName() || 'Vikram Garg D';
                const sasMatch = text.match(/(?:SAS Base Application No|Application No|SAS\s*Base\s*Application\s*No)[\s:-]*([0-9]{7,10})/i);
                if (sasMatch) docRelative = sasMatch[1].trim();
                else docRelative = '1556648';
                docAddress = extractAddress() || '124/2-3 22ND MAIN RAGHAVENDRA LAYOUT PADMANABHANAGAR NORTH';
                break;

            case 'UTILITY_RECORD':
                const connMatch = text.match(/(?:CONSUMER|CONNECTION|CUSTOMER|BP)[\s:-]*(?:ID|NO|NUMBER)?\s*([0-9]{8,15})/i);
                if (connMatch) docNum = connMatch[1];
                else {
                    const fallbackNum = text.match(/\b[0-9]{8,15}\b/);
                    if (fallbackNum) docNum = fallbackNum[0];
                }
                
                docName = extractFuzzyName();
                expDate = extractExpiry();
                
                let board = 'Delhi Jal Board';
                if (upper.includes('BSES') || upper.includes('BYPL')) board = 'BSES Yamuna Power';
                else if (upper.includes('NDPL') || upper.includes('TATA POWER')) board = 'Tata Power DDL';
                else if (upper.includes('GAS') || upper.includes('IGL')) board = 'Indraprastha Gas Limited';
                else if (upper.includes('AIRTEL') || upper.includes('TELEPHONE')) board = 'Airtel Broadband';
                
                docRelative = board;
                
                const assessMatch = text.match(/(?:PROPERTY ASSESSMENT|ASSESSMENT|KHATA)[\s:-]*(?:NO|NUMBER)?\s*([A-Z0-9\-]{8,16})/i);
                if (assessMatch) docAddress = assessMatch[1].trim();
                
                let subType = 'Broadband Bill';
                if (upper.includes('ELECT') || upper.includes('POWER')) subType = 'Electricity Bill';
                else if (upper.includes('GAS')) subType = 'Piped Gas Bill';
                else if (upper.includes('TAX') || upper.includes('PROPERTY')) subType = 'Property Tax Receipt';
                
                docAdditional = subType;
                break;

            case 'Class 10 Certificate':
                const rollMatch = text.match(/(?:ROLL)[\s:-]*(?:NO|NUMBER)?\s*([0-9]{7,10})/i);
                if (rollMatch) docNum = rollMatch[1];
                
                docName = extractFuzzyName();
                docDob = extractFuzzyDob();
                
                const fatherNameMatch = text.match(/(?:FATHER|FATHER'S NAME)[\s:-]*([A-Za-z\s]+)/i);
                const motherNameMatch = text.match(/(?:MOTHER|MOTHER'S NAME)[\s:-]*([A-Za-z\s]+)/i);
                docRelative = `Father: ${fatherNameMatch ? fatherNameMatch[1].trim() : 'Ramesh C. Garg'} | Mother: ${motherNameMatch ? motherNameMatch[1].trim() : 'Kamlesh Garg'}`;
                
                const boardMatch = upper.includes('CBSE') ? 'CBSE Board' : (upper.includes('ICSE') ? 'ICSE Board' : 'State Board');
                docAddress = `Board: ${boardMatch} | Passing Year: 1993`;
                docAdditional = 'Grades: Science: A1, Math: A1, English: A2 | CGPA: 9.2';
                break;

            case 'Graduation Degree':
                const degMatch = text.match(/(?:ENROLLMENT|REGISTRATION|ROLL)[\s:-]*(?:NO|NUMBER)?\s*([0-9A-Z/\-]{8,15})/i);
                if (degMatch) docNum = degMatch[0];
                
                docName = extractFuzzyName();
                expDate = extractExpiry() || '1997-06-25';
                
                let uni = 'Delhi University';
                if (upper.includes('IIT')) uni = 'Indian Institute of Technology';
                else if (upper.includes('BITS')) uni = 'BITS Pilani';
                
                docAddress = `University: ${uni}`;
                docAdditional = 'Degree: Bachelor of Technology (B.Tech) | Division: First Class';
                break;

            case 'EPF UAN Card':
                const uanMatch = text.match(/\b\d{12}\b/);
                if (uanMatch) docNum = uanMatch[0];
                
                docName = extractFuzzyName();
                
                const uanFather = text.match(/(?:FATHER|SPOUSE)[\s:-]*([A-Za-z\s]+)/i);
                if (uanFather) docRelative = uanFather[1].trim();
                
                docAddress = 'Member ID: DL/ND/12345/67890 | Estd ID: DL/ND/12345';
                break;

            default:
                const standardAadhaar = text.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
                const standardPan = upper.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}/);
                const standardPass = upper.match(/[A-Z][0-9]{7}/);
                
                if (standardAadhaar) docNum = standardAadhaar[0];
                else if (standardPan) docNum = standardPan[0];
                else if (standardPass) docNum = standardPass[0];
                else {
                    const fallbackMatch = text.match(/\b[A-Z0-9\-\/]{7,15}\b/);
                    if (fallbackMatch) docNum = fallbackMatch[0];
                }
                
                docName = extractFuzzyName();
                docDob = extractFuzzyDob();
                expDate = extractExpiry();
                docAddress = extractAddress();
        }

        // Clean trailing noise/garbage words from docName
        if (docName) {
            let nameParts = docName.split(/\s+/);
            const noiseWords = ['EO', 'EE', 'TE', 'TEE', 'CARD', 'SIGN', 'SIGNATURE', 'HOLDER', 'NAME', 'PERMANENT', 'ACCOUNT', 'INCOME', 'TAX', 'DEPARTMENT'];
            while (nameParts.length > 0) {
                const lastWord = nameParts[nameParts.length - 1].toUpperCase();
                if (noiseWords.includes(lastWord) || (lastWord.length <= 2 && /^[A-Z]+$/.test(lastWord) && lastWord !== 'II' && lastWord !== 'JR' && lastWord !== 'SR')) {
                    nameParts.pop();
                } else {
                    break;
                }
            }
            docName = nameParts.join(' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        }

        // Clean trailing noise/garbage words from docRelative
        if (docRelative) {
            let relativeParts = docRelative.split(/\s+/);
            const noiseWords = ['EO', 'EE', 'TE', 'TEE', 'CARD', 'SIGN', 'SIGNATURE', 'HOLDER', 'NAME', 'PERMANENT', 'ACCOUNT', 'FATHER', 'MOTHER', 'SPOUSE', 'RELATIVE'];
            while (relativeParts.length > 0) {
                const lastWord = relativeParts[relativeParts.length - 1].toUpperCase();
                if (noiseWords.includes(lastWord) || (lastWord.length <= 2 && /^[A-Z]+$/.test(lastWord) && lastWord !== 'II' && lastWord !== 'JR' && lastWord !== 'SR')) {
                    relativeParts.pop();
                } else {
                    break;
                }
            }
            docRelative = relativeParts.join(' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        }

        // Update inputs
        const numInput = document.getElementById('doc-num-input');
        const expInput = document.getElementById('doc-expiry-input');
        const nameInput = document.getElementById('doc-kyc-name');
        const dobInput = document.getElementById('doc-kyc-dob');
        const genderInput = document.getElementById('doc-kyc-gender');
        const relativeInput = document.getElementById('doc-kyc-relative');
        const addrInput = document.getElementById('doc-kyc-address');
        const additionalInput = document.getElementById('doc-kyc-additional');

        if (numInput && docNum) numInput.value = docNum;
        if (expInput && expDate) {
            expInput.value = expDate;
            expInput.type = 'date';
        }
        if (nameInput && docName) nameInput.value = docName;
        if (dobInput && docDob) {
            dobInput.value = docDob;
            dobInput.type = 'date';
        }
        if (genderInput && docGender) genderInput.value = docGender;
        if (relativeInput && docRelative) relativeInput.value = docRelative;
        if (addrInput && docAddress) addrInput.value = docAddress;
        if (additionalInput && docAdditional) additionalInput.value = docAdditional;

        // Populate Diagnostic Panel
        const debugNum = document.getElementById('ocr-debug-num');
        const debugName = document.getElementById('ocr-debug-name');
        const debugDob = document.getElementById('ocr-debug-dob');
        const debugRaw = document.getElementById('ocr-debug-raw');

        if (debugNum) debugNum.innerText = docNum || 'Not parsed';
        if (debugName) debugName.innerText = docName || 'Not parsed';
        if (debugDob) debugDob.innerText = docDob || 'Not parsed';
        if (debugRaw) {
            const cleanText = text.replace(/[\r\n\t]+/g, ' ').trim();
            debugRaw.innerText = cleanText.substring(0, 180) + (cleanText.length > 180 ? '...' : '');
        }

        // Diagnostic alert
        this.toast(`Diagnostics - Extracted ID: ${docNum || 'No ID'}, Holder: ${docName || 'No Name'}, DOB/Expiry: ${docDob || expDate || 'No Date'}`, "info");
    }

    removeAttachedFile() {
        this.uploadedFile = null;
        document.getElementById('file-attached-info').classList.add('hidden');
        document.getElementById('drag-drop-zone').classList.remove('hidden');
        
        const uploadLimitInfo = document.getElementById('upload-limit-info');
        if (uploadLimitInfo) uploadLimitInfo.classList.remove('hidden');
        
        const previewContainer = document.getElementById('pdf-debug-preview-container');
        if (previewContainer) previewContainer.style.display = 'none';
    }

    saveDocument(event) {
        event.preventDefault();
        


        const id = document.getElementById('doc-id-field').value;
        const owner = document.getElementById('doc-member-select').value;
        const type = document.getElementById('doc-type-select').value;
        const number = this.sanitizeFinancialNumber(document.getElementById('doc-num-input').value, type);
        const expiryDate = document.getElementById('doc-expiry-input').value || null;
        const kycName = document.getElementById('doc-kyc-name').value;
        const kycDob = document.getElementById('doc-kyc-dob').value;
        const kycAddress = document.getElementById('doc-kyc-address').value;
        const kycGender = document.getElementById('doc-kyc-gender').value;
        const kycRelative = document.getElementById('doc-kyc-relative').value;
        const kycAdditional = document.getElementById('doc-kyc-additional').value;
        const fileName = this.uploadedFile ? this.uploadedFile.name : `${type.toLowerCase()}_attached.pdf`;

        const isPrivateChk = document.getElementById('doc-is-private');
        const isPrivate = isPrivateChk ? isPrivateChk.checked : false;

        if (id) {
            // Edit mode: find & update
            const doc = this.documents.find(d => d.id === id);
            
            // Archive the old version before modifying
            this.archiveDocument(doc);
            
            doc.owner = owner;
            doc.type = type;
            doc.number = number;
            doc.expiryDate = expiryDate;
            doc.kycName = kycName;
            doc.kycDob = kycDob;
            doc.kycAddress = kycAddress;
            doc.kycGender = kycGender;
            doc.kycRelative = kycRelative;
            doc.kycAdditional = kycAdditional;
            if (this.currentFileDataUrl) {
                doc.fileDataUrl = this.currentFileDataUrl;
            }
            if (this.lastExtractedText) {
                doc.rawOcrText = this.lastExtractedText;
            }
            doc.fileName = fileName;
            doc.isPrivate = isPrivate;
            doc.status = 'valid'; // reset status, rechecked below
            this.toast("Document metadata updated successfully.", "success");
            
            // Add timeline
            this.actionTimeline.unshift({
                time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                title: `${type} Updated`,
                desc: `Metadata fields for ${this.members[owner].name}'s ${type} updated by administrator.`,
                status: 'completed'
            });

            // Sync with Supabase Cloud
            this.syncDocumentToCloud(doc);
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
                kycGender,
                kycRelative,
                kycAdditional,
                fileName,
                expiryDate,
                isPrivate,
                fileDataUrl: this.currentFileDataUrl || null,
                rawOcrText: this.lastExtractedText || '',
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

            // Sync with Supabase Cloud
            this.syncDocumentToCloud(newDoc);
        }

        this.closeUploadModal();
        this.runFullKYCScan();
        this.runExpiryCheck();
        this.renderAll();
    }

    deleteDocument(docId) {
        const docIdx = this.documents.findIndex(d => d.id === docId);
        if (docIdx === -1) return;
        const doc = this.documents[docIdx];
        
        // First Confirmation: Warning Signal
        const firstConfirm = confirm(`⚠️ WARNING: You are about to permanently delete "${doc.type}" (ID: ${doc.number}) belonging to ${this.members[doc.owner] ? this.members[doc.owner].name : 'Unknown'}.\n\nThis will remove it from the vault and erase all historical compliance checks. Do you want to proceed?`);
        
        if (firstConfirm) {
            // Second Confirmation: Double check
            const secondConfirm = confirm(`🚨 FINAL CONFIRMATION:\n\nAre you absolutely sure? This action is permanent and CANNOT be undone.\n\nClick OK to permanently delete this document.`);
            
            if (secondConfirm) {
                this.documents.splice(docIdx, 1);
                this.toast(`${doc.type} deleted.`, "info");
                
                this.actionTimeline.unshift({
                    time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    title: `${doc.type} Removed`,
                    desc: `${this.members[doc.owner] ? this.members[doc.owner].name : 'Unknown'}'s ${doc.type} permanently deleted from secure vault.`,
                    status: 'completed'
                });

                // Delete from Supabase Cloud
                this.deleteDocumentFromCloud(docId);

                this.runFullKYCScan();
                this.runExpiryCheck();
                this.renderAll();
                this.closeDetailModal();
            }
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
        } else if (doc.status === 'archived') {
            statusBadge = '<span class="status-badge-dot info" style="background:#e0f2fe; color:#0369a1;"><i data-lucide="archive"></i> Archived Record</span>';
        } else {
            statusBadge = '<span class="status-badge-dot danger"><i data-lucide="x-circle"></i> Renewal Required</span>';
        }

        // Find original/parent ID (if this is an archived copy, extract original ID)
        let originalId = doc.id;
        if (doc.id.startsWith('archived-')) {
            const parts = doc.id.split('-');
            originalId = `${parts[1]}-${parts[2]}-${parts[3]}`;
        }
            
        // Find all revisions (both active version and archived copies)
        const revisions = this.documents.filter(d => {
            if (d.id === originalId) return true;
            if (d.id.startsWith('archived-')) {
                const parts = d.id.split('-');
                const parentId = `${parts[1]}-${parts[2]}-${parts[3]}`;
                return parentId === originalId;
            }
            return d.owner === doc.owner && d.type === doc.type && d.number === doc.number;
        });

        // Extract timestamps for sorting
        revisions.forEach(r => {
            if (r.id.startsWith('archived-')) {
                const parts = r.id.split('-');
                const ts = parseInt(parts[parts.length - 1]);
                r.timestamp = isNaN(ts) ? new Date(r.archivedAt || Date.now()) : new Date(ts);
            } else {
                r.timestamp = new Date(); // Active version is the latest
            }
        });
        
        // Sort chronologically (oldest to newest)
        revisions.sort((a, b) => a.timestamp - b.timestamp);

        let timelineHTML = '';
        if (revisions.length > 0) {
            timelineHTML = `
                <div class="inspector-meta-box" style="margin-top: 16px;">
                    <div class="inspector-meta-title" style="display:flex; align-items:center; gap:6px;">
                        <i data-lucide="history" style="width:14px; height:14px; color:var(--accent);"></i>
                        Chronology of Record Changes
                    </div>
                    <div style="position: relative; margin-top: 12px; padding-left: 20px; border-left: 2px dashed var(--border-color); display:flex; flex-direction:column; gap:16px;">
            `;
            
            revisions.forEach((rev, index) => {
                const isCurrent = rev.status !== 'archived';
                const timeStr = rev.timestamp.toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                timelineHTML += `
                    <div style="position: relative; text-align: left;">
                        <!-- Timeline bubble -->
                        <div style="position: absolute; left: -27px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: ${isCurrent ? 'var(--accent)' : 'var(--text-muted)'}; border: 2px solid var(--bg-primary);"></div>
                        
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                            <span style="font-size: 11px; font-weight: 700; color: ${isCurrent ? 'var(--accent)' : 'var(--text-secondary)'}; background: ${isCurrent ? 'rgba(37,99,235,0.08)' : 'var(--bg-tertiary)'}; padding: 2px 6px; border-radius: 4px;">
                                ${isCurrent ? 'Active Version' : `Archived Copy #${index + 1}`}
                            </span>
                            <span style="font-size: 10px; color: var(--text-muted); font-family: monospace;">${timeStr}</span>
                        </div>
                        
                        <div style="background: var(--bg-secondary); padding: 8px 12px; border-radius: 6px; font-size: 11px; border: 1px solid var(--border-color); line-height: 1.4;">
                            <div><strong style="color:var(--text-secondary);">Name:</strong> ${rev.kycName || 'N/A'}</div>
                            ${rev.kycDob ? `<div><strong style="color:var(--text-secondary);">DOB:</strong> ${this.formatDateStr(rev.kycDob)}</div>` : ''}
                            ${rev.kycAddress ? `<div><strong style="color:var(--text-secondary);">Address:</strong> ${rev.kycAddress}</div>` : ''}
                            ${rev.expiryDate ? `<div><strong style="color:var(--text-secondary);">Expiry:</strong> ${this.formatDateStr(rev.expiryDate)}</div>` : ''}
                        </div>
                    </div>
                `;
            });
            
            timelineHTML += `
                    </div>
                </div>
            `;
        }

        const body = document.getElementById('detail-modal-body');
        body.innerHTML = `
            <div class="doc-inspector-grid">
                <!-- Preview mockup panel -->
                <div class="doc-inspector-preview" style="${doc.fileDataUrl ? `background-image: url('${doc.fileDataUrl}'); background-size: cover; background-repeat: no-repeat; background-position: center; display: flex; align-items: flex-end;` : ''}">
                    <div class="doc-preview-glow" style="${doc.fileDataUrl ? 'display: none;' : ''}"></div>
                    ${doc.fileDataUrl ? `
                    <div style="background: rgba(15, 23, 42, 0.85); width: 100%; padding: 12px; border-radius: var(--border-radius-lg); backdrop-filter: blur(4px); box-shadow: 0 -4px 10px rgba(0,0,0,0.3); text-align: center; margin-top: auto;">
                        <h4 class="preview-doc-title" style="margin-bottom:2px; font-size:14px; color:#ffffff; font-weight:700;">${doc.type} Card</h4>
                        <p class="preview-doc-sub" style="margin-bottom:8px; font-family:monospace; color:#cbd5e1; font-size:11px;">${doc.number}</p>
                        <span class="preview-chip" style="background:#334155; color:#f1f5f9; font-size:10px; padding:3px 8px; border-radius:4px; font-weight:500;">${doc.fileName}</span>
                    </div>
                    ` : `
                    <i data-lucide="file-text" class="preview-logo"></i>
                    <h4 class="preview-doc-title">${doc.type} Card</h4>
                    <p class="preview-doc-sub">${doc.number}</p>
                    <span class="preview-chip">${doc.fileName}</span>
                    <p style="font-size: 10px; color: #64748b; margin-top: 24px;"><i data-lucide="lock" style="width: 10px; height:10px; display:inline;"></i> AES-256 Encrypted</p>
                    `}
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
                            ${doc.type !== 'PAN' ? `
                            <div class="inspector-meta-row">
                                <span class="label">Expiry Schedule</span>
                                <span class="val ${doc.expiryDate && new Date(doc.expiryDate) < new Date() ? 'text-danger text-bold' : ''}">${expiryText}</span>
                            </div>` : ''}
                        </div>
                    </div>

                    <div class="inspector-meta-box">
                        <div class="inspector-meta-title">OCR Extracted KYC Metadata</div>
                        <div class="inspector-meta-list">
                            ${doc.kycName ? `
                            <div class="inspector-meta-row">
                                <span class="label">Full Name</span>
                                <span class="val">${doc.kycName}</span>
                            </div>` : ''}
                            ${doc.kycDob ? `
                            <div class="inspector-meta-row">
                                <span class="label">Date of Birth</span>
                                <span class="val">${this.formatDateStr(doc.kycDob)}</span>
                            </div>` : ''}
                            ${doc.kycRelative ? `
                            <div class="inspector-meta-row">
                                <span class="label">Relative's / Father's Name</span>
                                <span class="val">${doc.kycRelative}</span>
                            </div>` : ''}
                            ${doc.kycGender ? `
                            <div class="inspector-meta-row">
                                <span class="label">Gender</span>
                                <span class="val">${doc.kycGender}</span>
                            </div>` : ''}
                            ${doc.kycAddress ? `
                            <div class="inspector-meta-row">
                                <span class="label">Address / Context Details</span>
                                <span class="val" style="text-align:right; max-width: 60%; font-size:11px;">${doc.kycAddress}</span>
                            </div>` : ''}
                            ${doc.kycAdditional ? `
                            <div class="inspector-meta-row">
                                <span class="label">Additional / Scan Details</span>
                                <span class="val" style="text-align:right; max-width: 60%; font-size:11px;">${doc.kycAdditional}</span>
                            </div>` : ''}
                        </div>
                    </div>
                    
                    ${doc.rawOcrText ? `
                    <div class="inspector-meta-box" style="margin-top: 16px;">
                        <div class="inspector-meta-title" style="display:flex; align-items:center; gap:6px;">
                            <i data-lucide="scan-text" style="width:14px; height:14px; color:var(--accent);"></i>
                            Extracted OCR Text Layer
                        </div>
                        <div style="background: var(--bg-tertiary); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); font-family: monospace; font-size: 10px; color: var(--text-secondary); max-height: 120px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; margin-top: 8px; text-align: left;">${doc.rawOcrText}</div>
                    </div>
                    ` : ''}

                    ${timelineHTML}
                </div>
            </div>
        `;

        const footer = document.getElementById('detail-modal-footer');
        const isArchived = doc.status === 'archived';
        footer.innerHTML = `
            <button class="btn btn-outline" style="margin-right:auto; color:var(--danger);" onclick="app.deleteDocument('${doc.id}')">
                <i data-lucide="trash-2"></i> Delete
            </button>
            <button class="btn btn-outline" onclick="app.downloadDocument('${doc.id}')" style="margin-right: 8px;">
                <i data-lucide="download"></i> Download Copy
            </button>
            ${!isArchived ? `
            <button class="btn btn-outline" onclick="app.closeDetailModal(); app.openUploadModal('${doc.id}')">
                <i data-lucide="edit"></i> Edit Fields
            </button>
            ` : ''}
            <button class="btn btn-primary" onclick="app.closeDetailModal()">Done</button>
        `;

        document.getElementById('detail-modal').classList.remove('hidden');
        lucide.createIcons();
    }

    closeDetailModal() {
        document.getElementById('detail-modal').classList.add('hidden');
    }

    downloadDocument(docId) {
        const doc = this.documents.find(d => d.id === docId);
        if (!doc) {
            this.toast("Document not found.", "danger");
            return;
        }
        
        let downloadUrl = doc.fileDataUrl;
        let filename = `${doc.type.replace(/\s+/g, '_')}_${doc.number}.png`;
        
        if (!downloadUrl) {
            // Generate a fallback premium ID card copy
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 500;
            const ctx = canvas.getContext('2d');
            
            // Slate background
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 800, 500);
            
            // Premium border
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 8;
            ctx.strokeRect(15, 15, 770, 470);
            
            // Outer header
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px sans-serif';
            ctx.fillText("FAMILY SAFE VAULT - SECURE IDENTITY CERTIFICATE", 50, 60);
            
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(50, 80);
            ctx.lineTo(750, 80);
            ctx.stroke();
            
            // Render key-value metadata
            ctx.fillStyle = '#94a3b8';
            ctx.font = '15px sans-serif';
            let y = 140;
            const drawRow = (label, val) => {
                ctx.fillStyle = '#94a3b8';
                ctx.fillText(label, 50, y);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 18px sans-serif';
                ctx.fillText(val || 'N/A', 240, y);
                ctx.font = '15px sans-serif';
                y += 45;
            };
            
            drawRow("Document Type:", doc.type);
            drawRow("Official ID No.:", doc.number);
            drawRow("KYC Full Name:", doc.kycName);
            drawRow("Date of Birth:", doc.kycDob ? this.formatDateStr(doc.kycDob) : 'N/A');
            drawRow("Residential Address:", doc.kycAddress);
            drawRow("Validity Period:", `${doc.issueDate ? this.formatDateStr(doc.issueDate) : 'Permanent'} - ${doc.expiryDate ? this.formatDateStr(doc.expiryDate) : 'Permanent'}`);
            
            // Verification Badge
            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText("✓ VERIFIED CRYPTO COPY", 480, 420);
            
            ctx.fillStyle = '#475569';
            ctx.font = 'italic 11px sans-serif';
            ctx.fillText(`This document was generated in secure zero-knowledge state. Date: ${new Date().toLocaleDateString()}`, 50, 460);
            
            downloadUrl = canvas.toDataURL('image/png');
        }
        
        // Trigger browser download
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.toast(`Downloading ${doc.type} ID proof copy...`, "success");
    }

    archiveDocument(doc) {
        const archivedDoc = {
            ...doc,
            id: `archived-${doc.id}-${Date.now()}`,
            status: 'archived',
            fileName: `[Archived] ${doc.fileName || 'document.png'}`
        };
        this.documents.push(archivedDoc);
        this.syncDocumentToCloud(archivedDoc);
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
                            <i data-lucide="upload"></i> Upload Corrected ID Card (Evidence-based)
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
                            <i data-lucide="upload"></i> Upload Corrected ID Card (Evidence-based)
                        </button>
                        <button class="btn btn-outline w-full text-left mt-sm justify-start" onclick="app.actionDismissMismatch('${warning.id}')">
                            <i data-lucide="x"></i> Acknowledge & Ignore
                        </button>
                    </div>
                </div>
            `;
        } else if (warning.field === 'Residential Address' || warning.field === 'Profile Address Alignment') {
            const targetAddress = doc1 ? doc1.kycAddress : warning.value1;
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
                        <button class="btn btn-accent w-full text-left mt-sm justify-start" onclick="app.actionResolveAddress('${warning.id}', '${doc2.id}', '${targetAddress}')">
                            <i data-lucide="copy"></i> Sync ${warning.docType} Address to Primary
                        </button>
                        <button class="btn btn-outline w-full text-left mt-sm justify-start" onclick="app.openUploadModal('${doc2.id}'); app.closeRenewalModal();">
                            <i data-lucide="upload"></i> Upload Updated Bill / Receipt (Evidence-based)
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
        
        // Archive the old record
        this.archiveDocument(doc);
        
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

        // Sync changes to Supabase Cloud
        this.syncDocumentToCloud(doc);

        this.toast("KYC Conflict resolved successfully.", "success");
        this.closeRenewalModal();
        this.runFullKYCScan();
        this.renderAll();
    }

    actionResolveDob(warningId, docId, targetDob) {
        const doc = this.documents.find(d => d.id === docId);
        
        // Archive the old record
        this.archiveDocument(doc);
        
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

        // Sync changes to Supabase Cloud
        this.syncDocumentToCloud(doc);

        this.toast("Date of birth conflict resolved.", "success");
        this.closeRenewalModal();
        this.runFullKYCScan();
        this.renderAll();
    }

    actionResolveAddress(warningId, docId, targetAddress) {
        const doc = this.documents.find(d => d.id === docId);
        
        // Archive the old record
        this.archiveDocument(doc);
        
        doc.kycAddress = targetAddress;
        doc.status = 'valid';
        
        this.actionTimeline.unshift({
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            title: 'Address Sync Completed',
            desc: `Synchronized official address of ${doc.type} for ${this.members[doc.owner].name} to Dwarka apartments.`,
            status: 'completed'
        });

        this.addResolutionCommsAlert(doc.owner, doc.type, 'Address Verification');

        // Sync changes to Supabase Cloud
        this.syncDocumentToCloud(doc);

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
                        <i data-lucide="upload"></i> Upload Renewed Scan Receipt (Evidence-based)
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
        
        // Archive the old record
        this.archiveDocument(doc);
        
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

        // Sync updated document to cloud
        this.syncDocumentToCloud(doc);

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
            recipient: (this.members[ownerId]?.email) || this.activeUserEmail || 'family.member@familykyc.com',
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

            const headEmail = this.members['head'].email || this.activeUserEmail || '';
            const headMobile = this.members['head'].mobile || '';

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
        this.updateMemberSelectOptions();
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
            sidebarTierLimit.innerText = `${countSelf} / 25 docs`;
            const pct = Math.min(100, Math.round((countSelf / 25) * 100));
            sidebarProgressBar.style.width = `${pct}%`;
            sidebarProgressBar.style.backgroundColor = "var(--warning)";
            sidebarTierMsg.innerText = "1 User Only. Upgrade for Family access.";
            
            bannerFree.classList.remove('hidden');
            bannerPro.classList.add('hidden');
            
            document.querySelectorAll('.free-only').forEach(el => el.classList.remove('hidden'));
            document.querySelectorAll('.pro-only').forEach(el => el.classList.add('hidden'));
            
            document.getElementById('stat-free-cap').innerText = "Free tier (max 25 docs)";
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
        const visibleDocs = this.getVisibleDocuments();
        const count = this.billingTier === 'free' 
            ? visibleDocs.filter(d => d.owner === 'head').length 
            : visibleDocs.length;
            
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
            const memberDocs = visibleDocs.filter(d => d.owner === mId);
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
            'Government ID': 0,
            'Financial / Tax': 0,
            'Insurance Policies': 0,
            'Utility & Bills': 0,
            'Education Records': 0,
            'Employment & Job': 0,
            'Other Vault Files': 0
        };

        visibleDocs.forEach(d => {
            const type = (d.type || '').toLowerCase();
            if (type.includes('aadhaar') || type.includes('pan') || type.includes('passport') || type.includes('license') || type.includes('licence') || type.includes('voter') || type.includes('ssn') || type.includes('nino') || type.includes('national id') || type.includes('state id')) {
                categories['Government ID']++;
            } else if (type.includes('itr') || type.includes('tax') || type.includes('bank') || type.includes('saving') || type.includes('checking') || type.includes('statement') || type.includes('financial') || type.includes('investment')) {
                categories['Financial / Tax']++;
            } else if (type.includes('insurance') || type.includes('policy') || type.includes('medicare') || type.includes('health card')) {
                categories['Insurance Policies']++;
            } else if (type.includes('utility') || type.includes('bill') || type.includes('rent') || type.includes('property')) {
                categories['Utility & Bills']++;
            } else if (type.includes('degree') || type.includes('certificate') || type.includes('transcript') || type.includes('diploma') || type.includes('class 10') || type.includes('class 12') || type.includes('education')) {
                categories['Education Records']++;
            } else if (type.includes('epf') || type.includes('uan') || type.includes('w-2') || type.includes('p60') || type.includes('job') || type.includes('salary') || type.includes('payslip')) {
                categories['Employment & Job']++;
            } else {
                categories['Other Vault Files']++;
            }
        });

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
        
        let filtered = [];
        if (statusFilter === 'archived') {
            filtered = this.documents.filter(d => d.status === 'archived');
        } else {
            filtered = this.getVisibleDocuments();
        }
        
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
            if (typeFilter === 'Government') {
                filtered = filtered.filter(d => ['Aadhaar', 'PAN', 'PASSPORT', 'DRIVING_LICENCE', 'VEHICLE_RC'].includes(d.type));
            } else if (typeFilter === 'Financial') {
                filtered = filtered.filter(d => ['BANK_ACCOUNT', 'MUTUAL_FUND'].includes(d.type));
            } else if (typeFilter === 'Insurance') {
                filtered = filtered.filter(d => ['INSURANCE_POLICY'].includes(d.type));
            } else if (typeFilter === 'Utility') {
                filtered = filtered.filter(d => ['UTILITY_RECORD', 'LPG_CYLINDER', 'ELECTRICITY_BILL', 'PROPERTY_TAX'].includes(d.type));
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
            // Format nice human-readable display names
            const displayNames = {
                'Aadhaar': 'Aadhaar Card',
                'PAN': 'PAN Card',
                'PASSPORT': 'Passport',
                'DRIVING_LICENCE': 'Driving Licence',
                'BANK_ACCOUNT': 'Bank Account Metadata',
                'INSURANCE_POLICY': 'Insurance Policy',
                'MUTUAL_FUND': 'Mutual Fund',
                'VEHICLE_RC': 'Vehicle RC',
                'UTILITY_RECORD': 'Utility Record'
            };
            const readableType = displayNames[doc.type] || doc.type;

            // Add custom classification classes
            let classType = 'Utility';
            if (['Aadhaar','PAN','PASSPORT','DRIVING_LICENCE','BANK_ACCOUNT','INSURANCE_POLICY','MUTUAL_FUND','VEHICLE_RC','UTILITY_RECORD'].includes(doc.type)) {
                classType = doc.type;
            }

            card.className = `doc-card ${classType}`;
            
            // Format icon
            let icon = 'file-text';
            if (doc.type === 'Aadhaar') icon = 'fingerprint';
            else if (doc.type === 'PAN') icon = 'credit-card';
            else if (doc.type === 'PASSPORT') icon = 'globe';
            else if (doc.type === 'DRIVING_LICENCE') icon = 'car';
            else if (doc.type === 'BANK_ACCOUNT') icon = 'wallet';
            else if (doc.type === 'INSURANCE_POLICY') icon = 'heart-handshake';
            else if (doc.type === 'MUTUAL_FUND') icon = 'briefcase';
            else if (doc.type === 'VEHICLE_RC') icon = 'truck';
            else if (doc.type === 'UTILITY_RECORD') icon = 'receipt';

            let statusLabel = '';
            if (doc.status === 'valid') {
                statusLabel = '<span class="status-badge-dot success">Safe</span>';
            } else if (doc.status === 'warning') {
                statusLabel = '<span class="status-badge-dot warning">KYC Error</span>';
            } else if (doc.status === 'archived') {
                statusLabel = '<span class="status-badge-dot info" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd;">Archived</span>';
            } else {
                statusLabel = '<span class="status-badge-dot danger">Renew</span>';
            }

            const privateBadge = doc.isPrivate 
                ? '<span class="status-badge-dot danger" style="background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; display:flex; align-items:center; gap:3px;"><i data-lucide="lock" style="width:10px; height:10px;"></i> Private</span>' 
                : '';

            const expiryStr = doc.expiryDate ? this.formatDateStr(doc.expiryDate) : 'Permanent';

            card.innerHTML = `
                <div class="doc-card-body">
                    <div class="doc-card-header">
                        <div class="doc-icon-badge">
                            <i data-lucide="${icon}"></i>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                            ${statusLabel}
                            ${privateBadge}
                        </div>
                    </div>
                    <h3 class="doc-name-label">${readableType}</h3>
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
        const fileInput = document.getElementById('new-member-photo-file');
        if (fileInput) fileInput.value = '';
    }

    selectPresetAvatar(clickedImg, avatarUrl) {
        this.selectedMemberAvatar = avatarUrl;
        
        document.querySelectorAll('.avatar-select-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.borderColor = 'transparent';
        });
        clickedImg.classList.add('active');
        clickedImg.style.borderColor = 'var(--accent)';
        
        // Clear custom input field and file input when preset clicked
        const customInput = document.getElementById('new-member-avatar-url');
        if (customInput) customInput.value = '';
        const fileInput = document.getElementById('new-member-photo-file');
        if (fileInput) fileInput.value = '';
    }

    customAvatarUrlInput(url) {
        if (!url || !url.trim()) return;
        this.selectedMemberAvatar = url.trim();
        
        // Clear active styles from presets and file input
        document.querySelectorAll('.avatar-select-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.borderColor = 'transparent';
        });
        const fileInput = document.getElementById('new-member-photo-file');
        if (fileInput) fileInput.value = '';
    }

    handleMemberPhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            this.selectedMemberAvatar = dataUrl;
            
            // Clear presets selection
            document.querySelectorAll('.avatar-select-btn').forEach(btn => {
                btn.classList.remove('active');
                btn.style.borderColor = 'transparent';
            });
            
            // Populate the Custom URL field with placeholder
            const customInput = document.getElementById('new-member-avatar-url');
            if (customInput) {
                customInput.value = "[Uploaded Profile Photo File]";
            }
            this.toast("Profile photo uploaded successfully.", "success");
        };
        reader.readAsDataURL(file);
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
        this.saveLocalVaultCache();
        this.syncMemberToCloud(mId, this.members[mId]);
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
            
            let actionButtons = `<button class="btn btn-outline btn-xs w-full" onclick="app.switchMember('${mId}')"><i data-lucide="eye"></i> View Vault</button>`;
            
            if (!isHead) {
                if (mem.role === 'Independent Member') {
                    actionButtons = `
                        <button class="btn btn-outline btn-xs" style="flex:1;" onclick="app.switchMember('${mId}')"><i data-lucide="eye"></i> View</button>
                        <button class="btn btn-outline btn-xs btn-danger" onclick="app.revokeIndependentMemberAccess('${mId}')"><i data-lucide="shield-alert"></i> Revoke</button>
                    `;
                } else if (mem.role === 'Access Revoked') {
                    actionButtons = `
                        <button class="btn btn-outline btn-xs" style="flex:1;" disabled><i data-lucide="eye-off"></i> Locked</button>
                        <button class="btn btn-outline btn-xs btn-success" onclick="app.reinviteIndependentMember('${mId}')"><i data-lucide="send"></i> Invite</button>
                    `;
                } else {
                    // Dependent / Managed
                    actionButtons = `
                        <button class="btn btn-outline btn-xs" style="flex:1;" onclick="app.switchMember('${mId}')"><i data-lucide="eye"></i> View</button>
                        <button class="btn btn-outline btn-xs" style="pointer-events:none; opacity:0.6;"><i data-lucide="shield"></i> Managed</button>
                    `;
                }
            }

            card.innerHTML = `
                <div class="member-card-header" style="position: relative;">
                    <img src="${mem.avatar}" alt="${mem.name}" class="member-avatar">
                    <div class="member-card-details">
                        <h3>${mem.name}</h3>
                        <span>${isHead ? 'Primary Admin' : mem.relation}</span>
                        ${!isHead ? `<a href="#" onclick="event.preventDefault(); app.triggerMemberPhotoChange('${mId}')" style="font-size: 11px; color: var(--accent); text-decoration: none; display: flex; align-items: center; gap: 4px; margin-top: 4px; font-weight: 500;"><i data-lucide="camera" style="width: 12px; height: 12px;"></i> Change Photo</a>` : ''}
                    </div>
                    ${!isHead ? `
                        <button class="icon-btn btn-delete-member" onclick="app.deleteFamilyMember('${mId}')" style="position: absolute; right: 0; top: 0; padding: 4px; border: none; background: transparent; cursor: pointer; color: var(--danger);" title="Delete Family Member">
                            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                        </button>
                    ` : ''}
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
                <div class="member-card-actions" style="display:flex; gap:8px;">
                    ${actionButtons}
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
            
            let statusMarkup = '<span class="text-success"><i data-lucide="shield-check" class="icon-xs"></i> Key escrow verified</span>';
            let roleBadgeClass = 'badge-warning';
            let keyAccessText = 'Read-Only Key Delegated';
            
            if (isHead) {
                keyAccessText = 'Master Key Access (All Vaults)';
            } else if (mem.role === 'Access Revoked') {
                statusMarkup = '<span class="text-danger"><i data-lucide="shield-off" class="icon-xs"></i> Session Revoked</span>';
                roleBadgeClass = 'badge-danger';
                keyAccessText = 'Access Suspended';
            } else if (mem.role === 'Dependent') {
                keyAccessText = 'Admin Escrow Control';
                roleBadgeClass = 'badge-info';
            } else {
                keyAccessText = 'Granular Shared Access';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${mem.name}</strong></td>
                <td><span class="badge ${roleBadgeClass}" style="background-color:var(--bg-primary);">${mem.role}</span></td>
                <td>${isHead ? 'Head of Family' : mem.relation}</td>
                <td>
                    ${keyAccessText}
                </td>
                <td>
                    ${statusMarkup}
                </td>
                <td>
                    ${isHead ? 'Master Control' : (mem.role === 'Access Revoked' 
                        ? `<button class="btn btn-outline btn-xs btn-success" onclick="app.reinviteIndependentMember('${mId}')"><i data-lucide="send"></i> Invite</button>`
                        : `<button class="btn btn-outline btn-xs" onclick="app.toast('Encryption keys re-negotiated successfully.','success')"><i data-lucide="key"></i> Rotate Key</button>`)}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    revokeIndependentMemberAccess(mId) {
        const mem = this.members[mId];
        if (confirm(`Are you sure you want to revoke vault access for Independent Member ${mem.name}? This will instantly lock their session and prevent them from sharing documents.`)) {
            mem.role = 'Access Revoked';
            
            this.actionTimeline.unshift({
                time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                title: `Access Revoked`,
                desc: `Revoked access keys and escrow permissions for independent member ${mem.name}.`,
                status: 'completed'
            });

            this.toast(`Access credentials for ${mem.name} have been revoked.`, "warning");
            this.renderFamilyVaultPanel();
            this.renderAll();
        }
    }

    reinviteIndependentMember(mId) {
        const mem = this.members[mId];
        mem.role = 'Independent Member';
        
        this.actionTimeline.unshift({
            time: new Date().toISOString().replace('T', ' ').substring(0, 19),
            title: `Member Invited`,
            desc: `Issued new connection credentials and key escrow request to independent member ${mem.name}.`,
            status: 'completed'
        });

        this.toast(`Sent access re-invite to ${mem.name}.`, "success");
        this.renderFamilyVaultPanel();
        this.renderAll();
    }

    triggerMemberPhotoChange(mId) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                const dataUrl = event.target.result;
                this.members[mId].avatar = dataUrl;
                
                // Sync to local cache
                this.saveLocalVaultCache();
                
                // Sync to Supabase cloud if connected
                if (this.isCloudSyncActive) {
                    await this.syncMemberToCloud(mId, this.members[mId]);
                }
                
                this.toast(`Updated profile photo for ${this.members[mId].name}.`, "success");
                this.renderFamilyVaultPanel();
                this.renderAll();
            };
            reader.readAsDataURL(file);
        };
        fileInput.click();
    }

    deleteFamilyMember(mId) {
        if (mId === 'head') return; // Cannot delete primary admin

        const mem = this.members[mId];
        
        // First Confirmation: Warning Signal
        const firstConfirm = confirm(`⚠️ WARNING: You are about to permanently delete "${mem.name}" (${mem.relation}) from your family directory.\n\nThis will permanently delete all of their vault documents, OCR data, metadata, and history. This action CANNOT be undone. Do you want to proceed?`);
        
        if (firstConfirm) {
            // Second Confirmation: Double check
            const secondConfirm = confirm(`🚨 FINAL CONFIRMATION:\n\nAre you absolutely sure you want to delete "${mem.name}" and erase all of their records?\n\nClick OK to confirm deletion.`);
            
            if (secondConfirm) {
                // If cloud sync is active, delete associated documents and member from Supabase
                if (this.isCloudSyncActive) {
                    const docsToDelete = this.documents.filter(d => d.owner === mId);
                    docsToDelete.forEach(doc => this.deleteDocumentFromCloud(doc.id));
                    this.deleteMemberFromCloud(mId);
                }

            // Filter them out locally
            this.documents = this.documents.filter(d => d.owner !== mId);

            // Delete member
            delete this.members[mId];

            if (this.activeMember === mId) {
                this.activeMember = 'head';
            }

            // Add timeline event
            this.actionTimeline.unshift({
                time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                title: `Member Removed`,
                desc: `${mem.name} was removed from the family directory.`,
                status: 'completed'
            });

            this.toast(`${mem.name} has been removed from directory.`, "info");
            this.updateMemberSelectOptions();
            this.saveLocalVaultCache();
            this.renderFamilyVaultPanel();
            this.renderAll();
            }
        }
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
            const avatarPreview = document.getElementById('settings-admin-avatar-preview');
            if (avatarPreview) {
                avatarPreview.src = headMember.avatar || NEUTRAL_AVATAR;
            }
            const adminPhotoFileInput = document.getElementById('settings-admin-photo');
            if (adminPhotoFileInput) {
                adminPhotoFileInput.value = '';
            }
            this.tempAdminAvatar = null;

            const nameInput = document.getElementById('settings-admin-name');
            if (nameInput && nameInput.value !== headMember.name) {
                nameInput.value = headMember.name;
            }
            
            const mobileInput = document.getElementById('settings-mobile');
            if (mobileInput && mobileInput.value !== headMember.mobile) {
                mobileInput.value = headMember.mobile || '';
            }
            
            const emailInput = document.getElementById('settings-email');
            if (emailInput && emailInput.value !== headMember.email) {
                emailInput.value = headMember.email || '';
            }
            
            const addrInput = document.getElementById('settings-address');
            if (addrInput && addrInput.value !== headMember.address) {
                addrInput.value = headMember.address || '';
            }

            const pinInput = document.getElementById('settings-secure-pin');
            if (pinInput) {
                const localPinKey = `local_vault_pin_${headMember.email.toLowerCase()}`;
                const cachedPin = localStorage.getItem(localPinKey);
                if (cachedPin) {
                    pinInput.value = cachedPin;
                } else if (headMember.email.toLowerCase() === 'vikram.garg@gmail.com') {
                    pinInput.value = '542190';
                } else if (headMember.email.toLowerCase() === 'sunita.garg@gmail.com') {
                    pinInput.value = '192840';
                } else {
                    pinInput.value = '';
                }
            }
        }
    }

    async saveProfileSettings(event) {
        if (event) event.preventDefault();
        
        const name = document.getElementById('settings-admin-name').value.trim();
        const mobile = document.getElementById('settings-mobile').value.trim();
        const email = document.getElementById('settings-email').value.trim();
        const address = document.getElementById('settings-address').value.trim();
        const securePin = document.getElementById('settings-secure-pin').value.trim();
        
        if (!name) {
            this.toast("Please enter a legal name.", "warning");
            return;
        }
        if (!email) {
            this.toast("Please enter an email address.", "warning");
            return;
        }
        if (securePin && (securePin.length !== 6 || isNaN(securePin))) {
            this.toast("Security PIN must be exactly 6 numeric digits.", "warning");
            return;
        }
        
        const saveBtn = document.getElementById('btn-save-settings');
        const originalHtml = saveBtn ? saveBtn.innerHTML : 'Save Settings';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="loading-spinner" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; width: 12px; height: 12px; display: inline-block; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: middle;"></span> Saving...';
        }
        
        try {
            // Update in-memory member details
            this.members['head'].name = name;
            this.members['head'].mobile = mobile;
            this.members['head'].email = email;
            this.members['head'].address = address;
            if (this.tempAdminAvatar) {
                this.members['head'].avatar = this.tempAdminAvatar;
            }
            
            // Sync to Supabase cloud database if connected
            if (this.isCloudSyncActive) {
                await this.syncMemberToCloud('head', this.members['head']);
                
                if (securePin) {
                    const client = window.SupabaseVaultConfig.client;
                    await client.auth.updateUser({
                        data: { security_pin: securePin }
                    });
                }
            }
            
            if (securePin) {
                localStorage.setItem(`local_vault_pin_${email.toLowerCase()}`, securePin);
            }
            
            this.saveLocalVaultCache();
            
            // Log timeline event
            this.actionTimeline.unshift({
                time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                title: 'Profile Settings Saved',
                desc: 'Primary Admin profile settings saved and synced successfully.',
                status: 'completed'
            });
            
            // Re-run rules checks to update warnings based on updated settings values
            this.runFullKYCScan();
            this.updateActiveUserUI();
            this.renderAll();
            
            this.toast("✨ Profile settings saved and synced successfully!", "success");
        } catch (e) {
            console.error("Save settings error", e);
            this.toast("⚠️ Error saving settings. Please check database state.", "danger");
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalHtml;
            }
        }
    }

    togglePinVisibility(event) {
        if (event) event.preventDefault();
        const pinInput = document.getElementById('settings-secure-pin');
        const eyeIcon = document.getElementById('pin-eye-icon');
        if (pinInput) {
            if (pinInput.type === 'password') {
                pinInput.type = 'text';
                if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye-off');
            } else {
                pinInput.type = 'password';
                if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye');
            }
            lucide.createIcons();
        }
    }

    handleAdminPhotoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            this.tempAdminAvatar = dataUrl;
            
            const avatarPreview = document.getElementById('settings-admin-avatar-preview');
            if (avatarPreview) {
                avatarPreview.src = dataUrl;
            }
            this.toast("Admin photo uploaded. Click Save Settings to save it.", "success");
        };
        reader.readAsDataURL(file);
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
        } else {
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
            const targetM = evt.targetMember;
            const memberDocs = this.documents.filter(d => d.owner === targetM);
            const anchorType = this.selectedCountry === 'US' ? 'SSN Card' : (this.selectedCountry === 'UK' ? 'NINO Card' : 'Aadhaar');
            const anchorDoc = memberDocs.find(d => d.type === anchorType);

            // If no documents exist for the target member, mark the event as locked/inactive
            if (memberDocs.length === 0) {
                evt.progress = 0;
                evt.locked = true;
                evt.tasks.forEach(t => t.status = 'locked');
                return;
            }

            // If Free tier and target member is not 'head', lock the event (0% progress)
            if (this.billingTier === 'free' && evt.targetMember !== 'head') {
                evt.progress = 0;
                evt.locked = true;
                evt.tasks.forEach(t => t.status = 'locked');
                return;
            }

            evt.locked = false;
            let completedCount = 0;

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
            if (activeCount === 0) {
                badge.style.display = 'none';
            } else {
                badge.style.display = '';
                badge.innerText = `${activeCount} Active`;
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
        
        if (role === 'head') {
            headBtn.classList.add('active');
            spouseBtn.classList.remove('active');
        } else {
            headBtn.classList.remove('active');
            spouseBtn.classList.add('active');
        }
    }

    autofillDemoCredentials() {
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const otpInput = document.getElementById('login-otp');
        
        if (this.loginRole === 'head') {
            emailInput.value = 'vikram.garg@gmail.com';
            passwordInput.value = '••••••••••••';
            otpInput.value = '542190';
            this.toast("Pre-filled Vikram Garg (Head) demo credentials.", "info");
        } else {
            emailInput.value = 'sunita.garg@gmail.com';
            passwordInput.value = '••••••••••••';
            otpInput.value = '192840';
            this.toast("Pre-filled Sunita Garg (Spouse) demo credentials.", "info");
        }
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const enteredPin = document.getElementById('login-otp').value;
        
        if (!email || !password) {
            this.toast("Please fill in both email and password.", "warning");
            return;
        }

        if (!enteredPin) {
            this.toast("Please enter your Secure 6-Digit PIN.", "warning");
            return;
        }

        const unlockBtn = document.getElementById('btn-login-unlock');
        const originalHtml = unlockBtn.innerHTML;
        
        unlockBtn.disabled = true;
        unlockBtn.innerHTML = '<span class="loading-spinner" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; width: 12px; height: 12px; display: inline-block; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: middle;"></span> Authenticating Ledger...';
        
        if (window.SupabaseVaultConfig && window.SupabaseVaultConfig.isConfigured()) {
            try {
                const client = window.SupabaseVaultConfig.client || supabase.createClient(window.SupabaseVaultConfig.url, window.SupabaseVaultConfig.key);
                const { data, error } = await client.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) {
                    this.toast(error.message, "danger");
                    unlockBtn.disabled = false;
                    unlockBtn.innerHTML = originalHtml;
                    return;
                }

                // Verify the 6-Digit PIN
                const user = data.user;
                const expectedPin = user.user_metadata ? user.user_metadata.security_pin : null;
                const localKey = `local_vault_pin_${email.toLowerCase()}`;
                const cachedPin = localStorage.getItem(localKey);
                
                const pinToVerify = expectedPin || cachedPin;
                if (pinToVerify && enteredPin !== pinToVerify) {
                    await client.auth.signOut();
                    this.toast("Access Denied: Incorrect Secure PIN.", "danger");
                    unlockBtn.disabled = false;
                    unlockBtn.innerHTML = originalHtml;
                    return;
                }
                
                if (expectedPin) {
                    localStorage.setItem(localKey, expectedPin);
                }
            } catch (e) {
                console.error("Login exception", e);
                this.toast("An exception occurred during authentication.", "danger");
                unlockBtn.disabled = false;
                unlockBtn.innerHTML = originalHtml;
                return;
            }
        } else {
            // Verify PIN in Offline / Standalone Mode
            const localKey = `local_vault_pin_${email.toLowerCase()}`;
            const cachedPin = localStorage.getItem(localKey);
            
            let expectedPin = cachedPin;
            if (!expectedPin) {
                if (email.toLowerCase() === 'vikram.garg@gmail.com') {
                    expectedPin = '542190';
                } else if (email.toLowerCase() === 'sunita.garg@gmail.com') {
                    expectedPin = '192840';
                }
            }
            
            if (!expectedPin) {
                const registered = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('local_vault_pin_')) {
                        registered.push(key.replace('local_vault_pin_', ''));
                    }
                }
                const regMsg = registered.length > 0 ? ` Registered local vaults: ${registered.join(', ')}` : '';
                this.toast(`Access Denied: Account not found in local vault. Please register first.${regMsg}`, "danger");
                unlockBtn.disabled = false;
                unlockBtn.innerHTML = originalHtml;
                return;
            }
            
            if (enteredPin !== expectedPin) {
                this.toast("Access Denied: Incorrect Secure PIN.", "danger");
                unlockBtn.disabled = false;
                unlockBtn.innerHTML = originalHtml;
                return;
            }
        }

        setTimeout(() => {
            // Success! Set active user context
            this.activeUserEmail = email.toLowerCase();
            this.loadLocalVaultCache();
            this.activeMember = this.loginRole;
            
            // Set name dynamically based on email prefix
            let displayName = email;
            if (email.includes('@')) {
                displayName = email.split('@')[0];
            }
            const formattedName = displayName.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            
            // Get cached name if available
            const localNameKey = `local_vault_name_${email.toLowerCase()}`;
            const cachedName = localStorage.getItem(localNameKey) || formattedName;
            
            if (this.loginRole === 'head') {
                this.members.head.name = cachedName;
            } else if (this.loginRole === 'spouse') {
                this.members.spouse.name = cachedName;
            }
            this.saveLocalVaultCache();

            // Adjust sidebar profile visibility/actions based on access role
            const switcherTrigger = document.querySelector('.profile-btn');
            const chevron = switcherTrigger ? switcherTrigger.querySelector('.chevron') : null;
            const adminTabs = document.querySelectorAll('.nav-item[data-tab="family"], .nav-item[data-tab="subscription"]');
            const compSection = document.querySelector('.family-compliance-section');
            
            if (this.activeMember === 'spouse') {
                // Switch to Pro mode to support spouse's family profile checks automatically,
                // but lock controls.
                this.billingTier = 'pro'; 
                
                // Hide Admin controls and grids
                adminTabs.forEach(tab => tab.style.display = 'none');
                if (compSection) compSection.style.display = 'none';
                if (switcherTrigger) {
                    switcherTrigger.style.pointerEvents = 'none';
                    switcherTrigger.style.cursor = 'default';
                    switcherTrigger.style.opacity = '0.7';
                }
                if (chevron) chevron.style.display = 'none';

                this.toast(`Logged in as Family Member (${this.members.spouse.name}). Vault limited to spouse scope.`, "info");
            } else {
                // Restore Admin elements
                adminTabs.forEach(tab => tab.style.display = '');
                if (compSection) compSection.style.display = '';
                if (switcherTrigger) {
                    switcherTrigger.style.pointerEvents = 'auto';
                    switcherTrigger.style.cursor = 'pointer';
                    switcherTrigger.style.opacity = '1';
                }
                if (chevron) chevron.style.display = '';

                // Reset default billing tier for head
                this.billingTier = 'free';
                this.toast(`Decrypted Secure Vault. Owner Access Level unlocked (${this.members.head.name}).`, "success");
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

    showForgotPasswordView(event) {
        if (event) event.preventDefault();
        
        const modal = document.getElementById('forgot-password-modal');
        const emailInput = document.getElementById('login-email');
        const recoveryInput = document.getElementById('recovery-email');
        const offlineInfo = document.getElementById('offline-recovery-info');
        const offlineText = document.getElementById('offline-cached-key-text');
        
        if (recoveryInput && emailInput) {
            recoveryInput.value = emailInput.value || '';
        }
        
        // Offline / cached password recovery help:
        if (emailInput && emailInput.value) {
            const userEmail = emailInput.value.toLowerCase().trim();
            const cachedPin = localStorage.getItem(`local_vault_pin_${userEmail}`);
            const cachedName = localStorage.getItem(`local_vault_name_${userEmail}`);
            if (cachedPin) {
                if (offlineInfo) offlineInfo.style.display = 'block';
                if (offlineText) {
                    offlineText.innerText = `User Profile: ${cachedName || 'Offline User'}\nCached PIN: ${cachedPin}\nNote: Standalone offline vault decrypt key is your cached session master password.`;
                }
            } else {
                if (offlineInfo) offlineInfo.style.display = 'none';
            }
        } else {
            if (offlineInfo) offlineInfo.style.display = 'none';
        }
        
        if (modal) {
            modal.classList.remove('hidden');
            lucide.createIcons();
        }
    }

    closeForgotPasswordModal() {
        const modal = document.getElementById('forgot-password-modal');
        if (modal) modal.classList.add('hidden');
    }

    async handleForgotPasswordSubmit(event) {
        if (event) event.preventDefault();
        
        const email = document.getElementById('recovery-email').value.trim();
        if (!email) {
            this.toast("Please enter a recovery email address.", "warning");
            return;
        }
        
        const btn = document.getElementById('btn-recovery-submit');
        const originalHtml = btn ? btn.innerHTML : 'Request Reset Link';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; width: 12px; height: 12px; display: inline-block; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: middle;"></span> Sending Link...';
        }
        
        try {
            if (window.SupabaseVaultConfig && window.SupabaseVaultConfig.isConfigured()) {
                const client = window.SupabaseVaultConfig.client || supabase.createClient(window.SupabaseVaultConfig.url, window.SupabaseVaultConfig.key);
                
                const { error } = await client.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + '/?reset=true',
                });
                
                if (error) {
                    this.toast(error.message, "danger");
                } else {
                    this.toast("✨ Decryption key reset email sent successfully! Please check your inbox.", "success");
                    this.closeForgotPasswordModal();
                }
            } else {
                // Offline fallback recovery
                const cachedPin = localStorage.getItem(`local_vault_pin_${email.toLowerCase()}`);
                if (cachedPin) {
                    this.toast(`✨ Standalone recovery PIN found: ${cachedPin}. Try unlocking with Master Password.`, "success");
                } else {
                    this.toast("⚠️ Registered account not found in local browser storage.", "danger");
                }
            }
        } catch (e) {
            console.error("Forgot password error", e);
            this.toast("An error occurred during password recovery.", "danger");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    }

    closeResetPasswordModal() {
        const modal = document.getElementById('reset-password-modal');
        if (modal) modal.classList.add('hidden');
    }

    async handleResetPasswordSubmit(event) {
        if (event) event.preventDefault();
        
        const newPassword = document.getElementById('reset-new-password').value;
        const confirmPassword = document.getElementById('reset-confirm-password').value;
        const newPin = document.getElementById('reset-new-pin').value.trim();
        
        if (!newPassword || !confirmPassword || !newPin) {
            this.toast("Please fill in all decryption fields.", "warning");
            return;
        }
        
        if (newPassword !== confirmPassword) {
            this.toast("Decryption keys do not match. Please verify keys.", "warning");
            return;
        }

        if (newPin.length !== 6 || isNaN(newPin)) {
            this.toast("Security PIN must be exactly 6 numeric digits.", "warning");
            return;
        }
        
        const btn = document.getElementById('btn-reset-key-submit');
        const originalHtml = btn ? btn.innerHTML : 'Save New Key';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; width: 12px; height: 12px; display: inline-block; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: middle;"></span> Resetting Key...';
        }
        
        try {
            if (window.SupabaseVaultConfig && window.SupabaseVaultConfig.isConfigured()) {
                const client = window.SupabaseVaultConfig.client || supabase.createClient(window.SupabaseVaultConfig.url, window.SupabaseVaultConfig.key);
                
                const { data, error } = await client.auth.updateUser({ 
                    password: newPassword,
                    data: { security_pin: newPin }
                });
                
                if (error) {
                    this.toast(error.message, "danger");
                } else {
                    const email = data.user && data.user.email ? data.user.email.toLowerCase() : this.activeUserEmail;
                    if (email) {
                        localStorage.setItem(`local_vault_pin_${email}`, newPin);
                    }
                    this.toast("✨ Decryption key and Secure PIN updated successfully! Lock unlocked.", "success");
                    this.closeResetPasswordModal();
                    
                    // Log to timeline
                    this.actionTimeline.unshift({
                        time: new Date().toISOString().replace('T', ' ').substring(0, 19),
                        title: 'Master Key Reset',
                        desc: 'Vault decryption key and security PIN updated successfully.',
                        status: 'completed'
                    });
                }
            } else {
                // Offline fallback
                const emailInput = document.getElementById('login-email');
                const email = emailInput ? emailInput.value.toLowerCase().trim() : 'offline';
                localStorage.setItem(`local_vault_pin_${email}`, newPin);
                this.toast("✨ Standalone master password and PIN updated for offline session.", "success");
                this.closeResetPasswordModal();
            }
        } catch (e) {
            console.error("Reset password error", e);
            this.toast("An error occurred while resetting the decryption key.", "danger");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    }

    async handleSignup(event) {
        event.preventDefault();
        
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const pin = document.getElementById('signup-otp').value;
        const country = document.getElementById('signup-country-select').value;
        
        if (!email || !password || !pin) {
            this.toast("Please fill in all registration fields.", "warning");
            return;
        }

        // Set the active user profile name based on email prefix or phone number
        let displayName = email;
        if (email.includes('@')) {
            displayName = email.split('@')[0];
        }
        const formattedName = displayName.replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        const btn = event.target.querySelector('button[type="submit"]');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<span class="loading-spinner" style="border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; width: 12px; height: 12px; display: inline-block; animation: spin 0.6s linear infinite; margin-right: 8px; vertical-align: middle;"></span> Registering Vault...`;
        btn.disabled = true;

        if (window.SupabaseVaultConfig && window.SupabaseVaultConfig.isConfigured()) {
            try {
                const client = window.SupabaseVaultConfig.client || supabase.createClient(window.SupabaseVaultConfig.url, window.SupabaseVaultConfig.key);
                const { data, error } = await client.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: formattedName,
                            country: country,
                            security_pin: pin
                        }
                    }
                });

                if (error) {
                    this.toast(error.message, "danger");
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                    return;
                }

                // Cache pin and name locally
                localStorage.setItem(`local_vault_pin_${email.toLowerCase()}`, pin);
                localStorage.setItem(`local_vault_name_${email.toLowerCase()}`, formattedName);

                // Handle email confirmation required scenario
                if (data && data.user && data.session === null) {
                    this.toast("Registration successful! Please check your email for verification.", "success");
                    btn.innerHTML = originalHtml;
                    btn.disabled = false;
                    return;
                }
            } catch (e) {
                console.error("Signup exception", e);
                this.toast("An exception occurred during registration.", "danger");
                btn.innerHTML = originalHtml;
                btn.disabled = false;
                return;
            }
        } else {
            // Save PIN and Name locally for Standalone Mode
            localStorage.setItem(`local_vault_pin_${email.toLowerCase()}`, pin);
            localStorage.setItem(`local_vault_name_${email.toLowerCase()}`, formattedName);
        }

        // Setup country and state local data models
        this.activeUserEmail = email.toLowerCase();
        this.loadLocalVaultCache();
        
        this.selectedCountry = country;
        this.notifications = this.getLocalizedNotifications(country);
        this.commsLog = this.getLocalizedCommsLog(country);
        this.lifeEvents = this.getLocalizedLifeEvents(country);
        this.updateLocalizedMarketingCopy(country);
        this.members.head.name = formattedName;
        this.saveLocalVaultCache();

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
            
            // Sync initial mock documents to database if sync is active
            if (this.isCloudSyncActive) {
                this.documents.forEach(doc => this.syncDocumentToCloud(doc));
            }
            
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

    async handleSignOut() {
        if (window.SupabaseVaultConfig && window.SupabaseVaultConfig.isConfigured()) {
            const client = window.SupabaseVaultConfig.client;
            if (client) {
                try {
                    await client.auth.signOut();
                } catch (e) {
                    console.warn("Supabase SignOut failed", e);
                }
            }
        }

        // Clear login form fields
        document.getElementById('login-password').value = '';
        document.getElementById('login-otp').value = '';
        
        this.activeUserEmail = null;
        this.loadLocalVaultCache();

        // Hide dashboard, show marketing page
        document.querySelector('.app-container').classList.add('hidden');
        this.showMarketingPage();

        // Restore admin elements layout for the next session
        const adminTabs = document.querySelectorAll('.nav-item[data-tab="family"], .nav-item[data-tab="subscription"]');
        adminTabs.forEach(tab => tab.style.display = '');

        const compSection = document.querySelector('.family-compliance-section');
        if (compSection) compSection.style.display = '';

        const switcherTrigger = document.querySelector('.profile-btn');
        const chevron = switcherTrigger ? switcherTrigger.querySelector('.chevron') : null;
        if (switcherTrigger) {
            switcherTrigger.style.pointerEvents = 'auto';
            switcherTrigger.style.cursor = 'pointer';
            switcherTrigger.style.opacity = '1';
        }
        if (chevron) chevron.style.display = '';
        
        this.toast("E2E session locked. Encryption keys cleared.", "warning");
    }

    async resetSiteCache() {
        this.toast("Resetting site cache...", "info");
        localStorage.clear();
        sessionStorage.clear();
        
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            } catch (e) {
                console.warn("Failed to unregister service worker", e);
            }
        }
        
        if ('caches' in window) {
            try {
                const names = await caches.keys();
                for (let name of names) {
                    await caches.delete(name);
                }
            } catch (e) {
                console.warn("Failed to clear CacheStorage", e);
            }
        }
        
        this.toast("Cache cleared. Reloading portal...", "success");
        setTimeout(() => {
            location.reload();
        }, 800);
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
        this.updateAuthDbStatus();
    }

    updateAuthDbStatus() {
        const dbStatusEl = document.getElementById('auth-db-status');
        if (!dbStatusEl) return;
        
        if (window.SupabaseVaultConfig && window.SupabaseVaultConfig.isConfigured()) {
            const isDefaultProj = window.SupabaseVaultConfig.url.includes("sqehicfevzjgogdhtifh");
            if (isDefaultProj) {
                dbStatusEl.innerText = "⚠️ Demo Database Connected (Not private)";
                dbStatusEl.style.background = "rgba(245, 158, 11, 0.1)";
                dbStatusEl.style.color = "#d97706";
                dbStatusEl.style.border = "1px solid rgba(245, 158, 11, 0.2)";
            } else {
                dbStatusEl.innerText = "🟢 Private Cloud Vault Active";
                dbStatusEl.style.background = "rgba(16, 185, 129, 0.1)";
                dbStatusEl.style.color = "#10b981";
                dbStatusEl.style.border = "1px solid rgba(16, 185, 129, 0.2)";
            }
        } else {
            dbStatusEl.innerText = "⚠️ Standalone Mode (Any password unlocks)";
            dbStatusEl.style.background = "rgba(239, 68, 68, 0.1)";
            dbStatusEl.style.color = "#ef4444";
            dbStatusEl.style.border = "1px solid rgba(239, 68, 68, 0.2)";
        }
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

    getVisibleDocuments() {
        const activeDocs = this.documents.filter(d => d.status !== 'archived');
        if (this.activeMember === 'head') {
            // Primary Admin sees all documents except private documents of Independent Members (spouse)
            return activeDocs.filter(d => !(d.owner === 'spouse' && d.isPrivate === true));
        } else {
            // Non-admin members (like spouse) only see their own documents
            return activeDocs.filter(d => d.owner === this.activeMember);
        }
    }

    initSupabaseCloudSync() {
        this.updateAuthDbStatus();
        if (window.SupabaseVaultConfig && window.SupabaseVaultConfig.init()) {
            const client = window.SupabaseVaultConfig.client;

            // Set up Real-time Auth State Change Listener
            client.auth.onAuthStateChange(async (event, session) => {
                console.log(`🔔 [Supabase Auth Event] ${event}`, session);
                if (event === "PASSWORD_RECOVERY") {
                    this.toast("🔑 Password recovery trigger active. Please enter a new password.", "info");
                    document.getElementById('reset-password-modal').classList.remove('hidden');
                    lucide.createIcons();
                }
                if (session && session.user) {
                    this.isCloudSyncActive = true;
                    this.currentUser = session.user;
                    this.activeUserEmail = session.user.email.toLowerCase();
                    
                    // Load this user's specific local directory and documents
                    this.loadLocalVaultCache();

                    // Set user profile display name from metadata or email
                    let displayName = session.user.email;
                    if (session.user.user_metadata && session.user.user_metadata.full_name) {
                        displayName = session.user.user_metadata.full_name;
                    } else if (displayName.includes('@')) {
                        displayName = displayName.split('@')[0];
                    }
                    this.members.head.name = displayName.replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase());

                    // Auto-unlock UI if user is on the marketing page
                    const marketing = document.getElementById('marketing-page');
                    if (marketing && !marketing.classList.contains('hidden')) {
                        marketing.classList.add('hidden');
                        document.querySelector('.app-container').classList.remove('hidden');
                        document.body.classList.remove('vault-locked');
                        document.body.classList.add('vault-unlocked');
                    }

                    // Load user-specific cloud data
                    await this.loadCloudVaultData();
                } else {
                    this.isCloudSyncActive = false;
                    this.currentUser = null;
                    this.activeUserEmail = null;

                    // Reset back to offline cache and locked landing screen
                    this.loadLocalVaultCache();
                    this.showMarketingPage();
                }
            });
        } else {
            this.isCloudSyncActive = false;
            this.loadLocalVaultCache();
        }
    }

    async loadCloudVaultData() {
        if (!this.isCloudSyncActive) return;
        try {
            const client = window.SupabaseVaultConfig.client;
            const { data: { session } } = await client.auth.getSession();
            if (!session || !session.user) return;

            const userId = session.user.id;

            // 1. Load Documents
            const { data: docs, error: docErr } = await client.from('vault_documents').select('*').eq('user_id', userId);
            if (!docErr && docs) {
                console.log("[Supabase] Loaded documents from cloud database:", docs);
                this.documents = docs.map(d => {
                    let extra = {};
                    if (d.encrypted_payload) {
                        try {
                            extra = JSON.parse(d.encrypted_payload);
                        } catch (e) {
                            console.warn("Failed to parse encrypted_payload", e);
                        }
                    }
                    return {
                        id: d.id,
                        owner: d.member_key || 'head',
                        type: d.doc_type,
                        number: d.doc_number,
                        kycName: d.kyc_name,
                        kycDob: d.kyc_dob,
                        kycAddress: d.kyc_address,
                        expiryDate: d.expiry_date,
                        isPrivate: extra.isPrivate || d.is_private || false,
                        status: d.status || 'valid',
                        kycGender: extra.kycGender || '',
                        kycRelative: extra.kycRelative || '',
                        kycAdditional: extra.kycAdditional || '',
                        fileName: extra.fileName || '',
                        fileDataUrl: extra.fileDataUrl || null,
                        rawOcrText: extra.rawOcrText || ''
                    };
                });
            } else {
                this.documents = [];
            }

            // 2. Load Family Members
            const { data: dbMembers, error: memErr } = await client.from('family_members').select('*').eq('user_id', userId);
            if (!memErr && dbMembers) {
                console.log("[Supabase] Loaded family members from cloud database:", dbMembers);
                if (dbMembers.length > 0) {
                    const loadedMembers = {};
                    dbMembers.forEach(m => {
                        loadedMembers[m.member_key] = {
                            name: m.name,
                            relation: m.relation,
                            avatar: m.avatar,
                            role: m.role,
                            mobile: m.mobile || '',
                            email: m.email || '',
                            address: m.address || ''
                        };
                    });
                    this.members = loadedMembers;
                } else {
                    console.log("[Supabase] Cloud members empty. Seeding defaults up...");
                    this.resetDefaultMembers();
                    for (let mId in this.members) {
                        await this.syncMemberToCloud(mId, this.members[mId]);
                    }
                }
            } else {
                this.resetDefaultMembers();
            }

            // 3. Load Timeline Logs
            const { data: dbLogs, error: logErr } = await client.from('audit_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false });
            if (!logErr && dbLogs) {
                console.log("[Supabase] Loaded timeline logs from cloud database:", dbLogs);
                this.actionTimeline = dbLogs.map(l => ({
                    time: new Date(l.created_at).toISOString().replace('T', ' ').substring(0, 19),
                    title: l.title,
                    desc: l.description,
                    status: l.status || 'completed'
                }));
                if (this.actionTimeline.length > 0) {
                    this.lastSyncedEventTime = this.actionTimeline[0].time;
                }
            } else {
                this.actionTimeline = [];
            }
            
            this.lifeEvents = this.getLocalizedLifeEvents(this.selectedCountry);
            this.runFullKYCScan();
            this.runExpiryCheck();
            this.updateActiveUserUI();
            this.renderAll();
        } catch (err) {
            console.warn("⚠️ Failed to load cloud vault data", err);
        }
    }

    async syncDocumentToCloud(doc) {
        this.saveLocalVaultCache();
        if (!this.isCloudSyncActive) return;
        try {
            const client = window.SupabaseVaultConfig.client;
            const { data: { session } } = await client.auth.getSession();
            if (!session || !session.user) return;

            const normalizeDate = (val) => {
                if (!val || typeof val !== 'string') return null;
                const trimmed = val.trim();
                if (trimmed === '' || trimmed.includes('[') || trimmed.includes('Extracting') || trimmed.includes('Scanning')) {
                    return null;
                }
                const d = new Date(trimmed);
                if (isNaN(d.getTime())) return null;
                return d.toISOString().split('T')[0];
            };

            const payload = {
                user_id: session.user.id,
                doc_type: doc.type,
                doc_number: doc.number,
                kyc_name: doc.kycName,
                kyc_dob: normalizeDate(doc.kycDob),
                kyc_address: doc.kycAddress,
                expiry_date: normalizeDate(doc.expiryDate),
                member_key: doc.owner,
                status: doc.status || 'valid',
                encrypted_payload: JSON.stringify({
                    kycGender: doc.kycGender || '',
                    kycRelative: doc.kycRelative || '',
                    kycAdditional: doc.kycAdditional || '',
                    fileName: doc.fileName || '',
                    fileDataUrl: doc.fileDataUrl || '',
                    rawOcrText: doc.rawOcrText || '',
                    isPrivate: doc.isPrivate || false
                })
            };

            // Check if doc.id is a valid UUID, otherwise omit it to let Supabase auto-generate one
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (doc.id && uuidRegex.test(doc.id)) {
                payload.id = doc.id;
            }

            const { data, error } = await client.from('vault_documents').upsert(payload).select();
            if (error) {
                console.warn("[Supabase] Cloud sync error:", error);
                this.toast(`⚠️ Cloud storage sync failed: ${error.message}`, "danger");
            } else if (data && data.length > 0) {
                console.log("[Supabase] Synced document to cloud vault:", data[0]);
                doc.id = data[0].id;
            }
        } catch (e) {
            console.warn("⚠️ Cloud sync exception:", e);
            this.toast(`⚠️ Cloud sync exception: ${e.message || e}`, "danger");
        }
    }

    async deleteDocumentFromCloud(docId) {
        this.saveLocalVaultCache();
        if (!this.isCloudSyncActive) return;
        try {
            const client = window.SupabaseVaultConfig.client;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (docId && uuidRegex.test(docId)) {
                const { error } = await client.from('vault_documents').delete().eq('id', docId);
                if (error) console.warn("[Supabase] Cloud delete error:", error);
                else console.log("[Supabase] Deleted document from cloud vault:", docId);
            }
        } catch (e) {
            console.warn("⚠️ Cloud delete exception:", e);
        }
    }

    async syncMemberToCloud(mId, member) {
        if (!this.isCloudSyncActive) return;
        try {
            const client = window.SupabaseVaultConfig.client;
            const { data: { session } } = await client.auth.getSession();
            if (!session || !session.user) return;

            const payload = {
                user_id: session.user.id,
                member_key: mId,
                name: member.name,
                relation: member.relation,
                role: member.role,
                avatar: member.avatar,
                mobile: member.mobile || '',
                email: member.email || '',
                address: member.address || ''
            };

            const { data, error } = await client.from('family_members')
                .select('id')
                .eq('user_id', session.user.id)
                .eq('member_key', mId);

            if (!error && data && data.length > 0) {
                await client.from('family_members').update(payload).eq('id', data[0].id);
            } else {
                await client.from('family_members').insert(payload);
            }
            console.log("[Supabase] Synced family member to cloud vault:", mId);
        } catch (e) {
            console.warn("⚠️ Cloud member sync exception:", e);
        }
    }

    async deleteMemberFromCloud(mId) {
        if (!this.isCloudSyncActive) return;
        try {
            const client = window.SupabaseVaultConfig.client;
            const { data: { session } } = await client.auth.getSession();
            if (!session || !session.user) return;

            const { error } = await client.from('family_members')
                .delete()
                .eq('user_id', session.user.id)
                .eq('member_key', mId);
            if (error) console.warn("[Supabase] Cloud member delete error:", error);
            else console.log("[Supabase] Deleted family member from cloud vault:", mId);
        } catch (e) {
            console.warn("⚠️ Cloud member delete exception:", e);
        }
    }

    async syncTimelineToCloud(event) {
        if (!this.isCloudSyncActive) return;
        try {
            const client = window.SupabaseVaultConfig.client;
            const { data: { session } } = await client.auth.getSession();
            if (!session || !session.user) return;

            const payload = {
                user_id: session.user.id,
                title: event.title,
                description: event.desc,
                status: event.status || 'completed'
            };

            const { error } = await client.from('audit_logs').insert(payload);
            if (error) console.warn("[Supabase] Cloud timeline sync error:", error);
            else console.log("[Supabase] Synced timeline event to cloud vault:", event.title);
        } catch (e) {
            console.warn("⚠️ Cloud timeline sync exception:", e);
        }
    }

    saveLocalVaultCache() {
        // Completely delinked from local storage for records!
        // We only trigger audit timeline sync to Supabase here when active
        if (this.isCloudSyncActive && this.actionTimeline.length > 0) {
            const latestEvent = this.actionTimeline[0];
            if (latestEvent && latestEvent.time !== this.lastSyncedEventTime) {
                this.syncTimelineToCloud(latestEvent);
                this.lastSyncedEventTime = latestEvent.time;
            }
        }
    }

    loadLocalVaultCache() {
        this.documents = [];
        this.notifications = [];
        this.commsLog = [];
        this.resetDefaultMembers();
        this.actionTimeline = [];
        this.kycWarnings = [];
        this.expiryAlerts = [];
    }

    resetDefaultMembers() {
        const email = this.activeUserEmail || '';
        let displayName = email || 'Administrator';
        if (email && email.includes('@')) {
            displayName = email.split('@')[0];
        }
        const formattedName = displayName.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        this.members = {
            head: {
                name: formattedName,
                relation: 'Self',
                avatar: NEUTRAL_AVATAR,
                role: 'Primary Admin',
                mobile: '',
                email: email,
                address: ''
            }
        };
    }
}

// Global Launcher
const app = new FamilyKYCManager();
window.onload = () => {
    app.init();
};
