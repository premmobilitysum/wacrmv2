# Complete API Reference: Driver Lifecycle in APICabSoftware

Source: `D:\AWorkSpaceIBECarRental\APICabSoftware\CabSoftwareGuestApi\Controllers\DriverController.cs`  
Backend Base URL: `https://<your-cab-api-domain>/api` (or local IIS port)

---

## 1. Driver Registration & KYC Onboarding APIs

### 1.1 Send OTP for Driver Registration
- **Endpoint**: `POST /api/Driver/GetDriverRegisterOTPNew`
- **Controller Method**: `DriverController.GetDriverRegisterOTPNew([FromBody] JObject jobj)`
- **Request Body**:
  ```json
  {
    "OrgId": 102,
    "MobileNo": "9876543210",
    "OTPCode": "1234"
  }
  ```
- **Stored Procedure**: `udsp_Apps_DriverSmsValidate` (Flag = 8)
- **Response**:
  ```json
  {
    "Cargo": [
      {
        "Status": "1",
        "Message": "OTP Sent Successfully",
        "MobileCode": "1234"
      }
    ]
  }
  ```

---

### 1.2 Submit Driver Registration Details
- **Endpoint**: `POST /api/Driver/GetDriverRegisterNew`
- **Controller Method**: `DriverController.GetDriverRegisterNew([FromBody] JObject jobj)`
- **Request Body**:
  ```json
  {
    "OrgId": 102,
    "FullName": "Ramesh Kumar",
    "MobileNo": "9876543210",
    "EmailId": "ramesh@gmail.com",
    "City": "New Delhi",
    "Address": "House No 12, Sector 15, Rohini",
    "AppsMobileNo": "9876543210",
    "IMEINO": "864293847291823",
    "RegEmailId": "ramesh@gmail.com",
    "AppsDeviceId": "DEV-WHATSAPP-ONBOARD",
    "DeviceName": "WhatsApp CRM",
    "DeviceModel": "WA-Bot",
    "AndroidVersion": "14",
    "FcmId": "",
    "IpAddress": "127.0.0.1",
    "ReferralCode": "",
    "StateId": "1",
    "CityId": "10"
  }
  ```
- **Stored Procedure**: `udsp_Apps_DriverSmsValidate` (Flag = 5)
- **Response**: Returns newly created `RegDriverId` / `DriverId` and login credentials.

---

### 1.3 Upload Driver Documents & Vehicle KYC
- **Endpoint**: `POST /api/Driver/GetDriverRegisterDocumentNew`
- **Controller Method**: `DriverController.GetDriverRegisterDocumentNew([FromBody] JObject jobj)`
- **Request Body**:
  ```json
  {
    "OrgId": 102,
    "RegDriverId": 5421,
    "DLNo": "DL-1420110012345",
    "DLExpiryDate": "2030-12-31",
    "AadharNo": "123456789012",
    "VehicleNo": "DL01AB1234",
    "VehicleModel": "Swift Dzire",
    "VehicleExpiryDate": "2028-05-15",
    "VehicleModelYear": "2022",
    "VehicleColor": "White",
    "TouristPermitExpiryDate": "2027-01-01",
    "VehicleInsuranceExpiryDate": "2027-06-30",
    "ParentFolderId": "",
    "DriverPhotoId": "https://wab.easyets.com/storage/driver_photo.jpg",
    "DLFrontPhotoId": "https://wab.easyets.com/storage/dl_front.jpg",
    "DLBackPhotoId": "https://wab.easyets.com/storage/dl_back.jpg",
    "AadharFrontPhotoId": "https://wab.easyets.com/storage/aadhar_front.jpg",
    "AadharBackPhotoId": "https://wab.easyets.com/storage/aadhar_back.jpg",
    "VehicleRCPhotoId": "https://wab.easyets.com/storage/rc_front.jpg",
    "VehicleRCPhotoIdBack": "https://wab.easyets.com/storage/rc_back.jpg",
    "TouristPermitPhotoId": "",
    "VehicleInsurancePhotoId": ""
  }
  ```

---

### 1.4 Driver Approval Status
- **Endpoint**: `POST /api/Driver/GetDriverRegisterApprovalNew`
- **Controller Method**: `DriverController.GetDriverRegisterApprovalNew([FromBody] JObject jobj)`
- **Check Driver Profile**: `POST /api/Driver/GetDriverProfileNew`

---

## 2. Ride Broadcast & Driver Assignment APIs

### 2.1 Get Driver Broadcast Rides
- **Endpoint**: `GET /api/Driver/BroadCastBookingByDriver?OrgId={OrgId}&DriverId={DriverId}&Items={Items}&BookingId={BookingId}`
- **Controller Method**: `DriverController.BroadCastBookingByDriver(int OrgId, int DriverId, int Items, int BookingId)`
- **Parameters**:
  - `OrgId`: Organization / Tenant ID (e.g. 102)
  - `DriverId`: Driver ID in system
  - `Items`: Item count / radius filter
  - `BookingId`: Specific booking ID (or 0 for all open broadcasts)
- **Response**: List of available unassigned bookings with Pickup Address, Drop Address, Date/Time, Expected Fare, Distance.

---

### 2.2 Driver Accept Booking
- **Endpoint**: `GET /api/Driver/GetDriverBookingAccept?flag=5&orgid={orgid}&locationid=0&driverid={driverid}&bookingid={bookingid}&domainname={domainname}&multibookingrefid=0`
- **Controller Method**: `DriverController.GetDriverBookingAccept(int flag, int orgid, string locationid, int driverid, int bookingid, string domainname, int multibookingrefid = 0)`
- **Parameters**:
  - `flag`: `5` (Accept Ride)
  - `orgid`: Org ID (e.g. 102)
  - `locationid`: Current Location ID / 0
  - `driverid`: Driver ID accepting the booking
  - `bookingid`: Booking PNR ID
- **Internal Triggers**:
  - Locks booking atomically in database to prevent double assignment.
  - Fires `Helper.WHATSAPPAPI.PostWhatsAppMessageOnBooking(orgid, bookingid, 4)` to notify passenger of driver allocation with Car No, Driver Name, Mobile, OTP!

---

## 3. Trip Lifecycle & Status Tracking APIs

### 3.1 Driver Arrived at Pickup Point
- **Endpoint**: `POST /api/Driver/UpdateDriverRecentLocation`
- **Controller Method**: `DriverController.UpdateDriverRecentLocation([FromBody] JObject jobj)`
- **Request Body**:
  ```json
  {
    "OrgId": 102,
    "DriverId": 5421,
    "BookingId": 98124,
    "Latitude": "28.6139",
    "Longitude": "77.2090",
    "Status": "Arrived",
    "Action": "AtPickupPoint"
  }
  ```
- **Alternative / Event Trigger**: `InformBookingStatusToAll`
  - Triggers WhatsApp Notification to Guest: *"Your driver has arrived at the pickup location. Please share Start OTP with driver."*

---

### 3.2 Trip Start (Guest OTP Verification)
- **Endpoint**: `GET /api/Driver/ValidateOTPCodeByAction?orgid={orgid}&driverid={driverid}&otpcode={otpcode}&status={status}&bookingid={bookingid}`
- **Controller Method**: `DriverController.ValidateOTPCodeByAction(int orgid, string driverid, string otpcode, string status, int bookingid)`
- **Parameters**:
  - `orgid`: Org ID (102)
  - `driverid`: Driver ID
  - `otpcode`: 4-digit passenger OTP
  - `status`: `"StartTrip"`
  - `bookingid`: Booking ID
- **Alternative Resend OTP**: `GET /api/Driver/ResendOtpCode?orgid={orgid}&driverid={driverid}&bookingid={bookingid}&otpcode={otpcode}`
- **Result**: Trip status changes to `Running` (With Guest).

---

### 3.3 Trip Running (Periodic GPS & Route)
- **Endpoint**: `POST /api/Driver/SetBookingPeriodicLocation`
- **Controller Method**: `DriverController.SetBookingPeriodicLocation([FromBody] JObject jobj)`
- **Parameters**: `BookingId`, `DriverId`, `Latitude`, `Longitude`, `Speed`, `Heading`.

---

### 3.4 Toll, Parking & Extra Charges Entry
- **Endpoint**: `POST /api/Driver/SetImagesBooking`
- **Controller Method**: `DriverController.SetImagesBooking([FromBody] JObject jobj)`
- **Parameters**: `BookingId`, `TollAmount`, `ParkingAmount`, `TollSlipPhoto`.

---

### 3.5 Trip Completed & Final Payment Collection
- **Endpoint**: `POST /api/Driver/SetFinalPayment`
- **Controller Method**: `DriverController.SetFinalPayment([FromBody] JObject jobj)`
- **Request Body**:
  ```json
  {
    "OrgId": 102,
    "BookingId": 98124,
    "DriverId": 5421,
    "StartKm": 12000,
    "EndKm": 12045,
    "TotalKm": 45,
    "ExtraKmCharge": 150.0,
    "TollCharge": 100.0,
    "ParkingCharge": 50.0,
    "TotalPaid": 850.0,
    "PaymentMode": "Cash",
    "SignatureUrl": "https://..."
  }
  ```
- **Alternative Close Status**: `POST /api/Driver/SaveCloseStatus`
- **Internal Triggers**:
  - Calculates final invoice.
  - Sends final invoice WhatsApp to passenger with PDF invoice link and rating prompt!
