# WhatsApp CRM Automation Architecture for Driver Lifecycle

This document explains how your hosted WhatsApp CRM (**`https://wab.easyets.com`**) connects to **`D:\AWorkSpaceIBECarRental`** (`APICabSoftware`) to automate the entire driver and ride lifecycle.

---

## 1. System Integration Overview

```
 +-----------------------------------------------------------------------------------+
 |                          HOSTED WHATSAPP CRM (wab.easyets.com)                     |
 |                                                                                   |
 |  [Trigger: Keyword / Inbound]       [Flow Steps]             [Outbound API / Webhook]
 |  • "Driver Register"            ---> • Send Template    ---> • POST /api/v1/messages
 |  • "Accept Booking #123"             • Condition             • Send Webhook
 |  • Button Click                      • Add Tag ("Driver")    • Wait / Timer
 +----------------------------------------+------------------------------------------+
                                          |
                        HTTP REST Webhooks / API Calls
                                          |
                                          v
 +-----------------------------------------------------------------------------------+
 |                   APICabSoftware Backend (D:\AWorkSpaceIBECarRental)              |
 |                                                                                   |
 |  1. Driver Registration   : /api/Driver/GetDriverRegisterNew                      |
 |  2. Driver Document KYC   : /api/Driver/GetDriverRegisterDocumentNew              |
 |  3. Broadcast to Drivers  : /api/Driver/BroadCastBookingByDriver                   |
 |  4. Driver Accept Booking : /api/Driver/GetDriverBookingAccept                     |
 |  5. At Pickup Point       : /api/Driver/UpdateDriverRecentLocation                |
 |  6. Start Ride (Verify OTP): /api/Driver/ValidateOTPCodeByAction                   |
 |  7. Ride Completed        : /api/Driver/SetFinalPayment                            |
 +-----------------------------------------------------------------------------------+
```

---

## 2. Automation Flows Breakdown

### Flow 1: New Driver Registration WhatsApp Automation
- **Trigger**: `Keyword Match` or `New Message Received`
  - Keywords: `register driver`, `driver join`, `driver onboard`, `driver attach`
- **Automation Steps**:
  1. **Send Message / Buttons**:
     > *"Welcome to EasyETS Fleet Partner Network! 🚕 Would you like to register as a new driver?"*
     > [Button 1: Register Now] [Button 2: Talk to Support]
  2. **Collect Information / Send Link**:
     > *"Please reply with your Details: Full Name, City, Driving License Number, and Vehicle Number."*
     > (Or send a quick onboarding web link prefilled with their mobile number)
  3. **Send Webhook Step**:
     - **URL**: `https://<your-cab-api>/api/Driver/GetDriverRegisterNew`
     - **Method**: `POST`
     - **Payload**:
       ```json
       {
         "OrgId": 102,
         "FullName": "{{contact.name}}",
         "MobileNo": "{{contact.phone}}",
         "City": "Delhi",
         "AppsMobileNo": "{{contact.phone}}"
       }
       ```
  4. **Add Tag**: `Driver - Pending Documents`
  5. **Send Confirmation Message**:
     > *"Thank you {{contact.name}}! Your driver application has been received. Our operations team will verify your documents and activate your duty status shortly."*

---

### Flow 2: Ride Broadcast to Drivers (Interactive Alert)
- **Initiated By**: `APICabSoftware` when a passenger books a cab and dispatch broadcast begins.
- **Action**: Calls `https://wab.easyets.com/api/v1/messages` with secret API Key.
- **Message Type**: `interactive` (or WhatsApp Template with Quick Reply buttons)
  - **Text**:
    > *"🔔 NEW RIDE AVAILABLE!*  
    > *Booking ID:* #{{BookingId}}  
    > *Pickup:* {{PickupAddress}}  
    > *Drop:* {{DropAddress}}  
    > *Fare:* ₹{{TotalFare}} | *Distance:* {{TotalKm}} km  
    > *Pickup Time:* {{PickupTime}}*  
    > Tap below to accept this ride immediately!"*
  - **Buttons**:
    - `Accept #{{BookingId}}` (reply_id: `ACCEPT_{{BookingId}}`)
    - `Decline` (reply_id: `DECLINE_{{BookingId}}`)
- **CRM Automation Trigger on Tap**:
  - `interactive_reply` with reply_id matching `ACCEPT_*`
  - **Webhook Step**:
    - URL: `https://<your-cab-api>/api/Driver/GetDriverBookingAccept?flag=5&orgid=102&locationid=0&driverid={{contact.driver_id}}&bookingid={{BookingId}}`
  - **Condition**: If API returns `"Status": "1"` -> Send: *"Booking Confirmed! Please proceed to pickup location."* Else -> *"Sorry, this booking was accepted by another driver."*

---

### Flow 3: Driver Arrived at Pickup Point ("At Pickup Point")
- **Trigger**: Driver taps *"I Have Arrived"* in DriverApp or replies via WhatsApp.
- **Backend API**: `POST /api/Driver/UpdateDriverRecentLocation` (Action: `AtPickupPoint`)
- **WhatsApp Alert to Guest**:
  - Sent via `POST /api/v1/messages` to Guest phone number:
    > *"🚖 Your driver {{DriverName}} ({{CarNo}}) has arrived at your pickup location.*  
    > *Start OTP:* **{{OTP}}**  
    > Please share this OTP with the driver once you board the vehicle."*

---

### Flow 4: Ride Started ("With Guest")
- **Trigger**: Driver enters customer OTP in DriverApp -> API verifies `ValidateOTPCodeByAction`.
- **WhatsApp Alert to Guest**:
  - Sent via `POST /api/v1/messages`:
    > *"✅ Your trip has started!*  
    > *Destination:* {{DropAddress}}  
    > *Live Tracking:* {{LiveTrackingUrl}}  
    > In case of emergency, you can use our 24/7 SOS helpline. Have a safe journey!"*

---

### Flow 5: Ride Completed ("Completed & Invoice")
- **Trigger**: Driver taps *"End Trip"* and submits final km/tolls -> API calls `SetFinalPayment`.
- **WhatsApp Alert to Guest**:
  - Sent via `POST /api/v1/messages`:
    > *"🏁 You have reached your destination!*  
    > *Total Distance:* {{TotalKm}} km  
    > *Total Fare:* ₹{{TotalAmount}}  
    > *Payment Mode:* {{PaymentMode}}  
    > 📄 Download Invoice: {{InvoiceUrl}}  
    > ⭐ How was your ride? Reply 1 to 5 to rate your driver."*
- **WhatsApp Alert to Driver**:
  - Sent to Driver:
    > *"Trip #{{BookingId}} completed!*  
    > *Earning:* ₹{{DriverEarnings}} added to your wallet. Current wallet balance: ₹{{WalletBalance}}."*
