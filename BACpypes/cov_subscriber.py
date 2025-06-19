#!/usr/bin/env python3

from bacpypes.core import run, stop
from bacpypes.local.device import LocalDeviceObject
from bacpypes.app import BIPSimpleApplication
from bacpypes.object import get_object_class
from bacpypes.pdu import Address
from bacpypes.primitivedata import ObjectIdentifier
from bacpypes.constructeddata import Any
from bacpypes.apdu import SubscribeCOVRequest, SimpleAckPDU, ErrorPDU
from bacpypes.iocb import IOCB
from bacpypes.core import deferred
from bacpypes.errors import ExecutionError

# Configuration
DEVICE_ID = 999
DEVICE_NAME = "COV_Subscriber"
VENDOR_ID = 842
LOCAL_ADDRESS = "0.0.0.0"  # Écoute sur toutes les interfaces

# Target device configuration
TARGET_IP = "10.133.5.100"
TARGET_DEVICE_ID = 1000
TARGET_OBJECT_TYPE = 260  # Binary Value
TARGET_OBJECT_INSTANCE = 87

class COVSubscriberApplication(BIPSimpleApplication):
    def __init__(self):
        # Create a local device object
        self.local_device = LocalDeviceObject(
            objectName=DEVICE_NAME,
            objectIdentifier=('device', DEVICE_ID),
            vendorIdentifier=VENDOR_ID,
        )

        # Initialize the application with local address
        BIPSimpleApplication.__init__(self, self.local_device, LOCAL_ADDRESS)

    def subscribe_to_cov(self):
        try:
            # Create the target address
            target_address = Address(TARGET_IP)
            
            # Create the object identifier using the correct format
            object_identifier = ObjectIdentifier('binaryValue:87')

            print(f"Attempting to subscribe to COV for object: {object_identifier}")
            print(f"Target device: {TARGET_IP}")

            # Create the subscription request with more specific parameters
            request = SubscribeCOVRequest(
                subscriberProcessIdentifier=1,
                monitoredObjectIdentifier=object_identifier,
                issueConfirmedNotifications=True,
                lifetime=3600,  # 1 hour lifetime
                covIncrement=1.0,  # Minimum change to trigger notification
            )
            request.pduDestination = target_address

            # Create an IOCB
            iocb = IOCB(request)
            
            # Add a callback for the response
            iocb.add_callback(self.subscription_response)
            
            # Send the request
            self.request_io(iocb)
            
        except Exception as e:
            print(f"Error during subscription setup: {str(e)}")

    def subscription_response(self, iocb):
        if iocb.ioResponse:
            print("Subscription successful!")
            print(f"Response: {iocb.ioResponse}")
        elif iocb.ioError:
            print(f"Error during subscription: {iocb.ioError}")
            if isinstance(iocb.ioError, ExecutionError):
                print(f"Error details: {iocb.ioError.errorClass}, {iocb.ioError.errorCode}")
            elif isinstance(iocb.ioError, ErrorPDU):
                print(f"Error PDU: {iocb.ioError.errorClass}, {iocb.ioError.errorCode}")

    def do_ConfirmedCOVNotificationRequest(self, apdu):
        try:
            print(f"Received COV notification for {apdu.monitoredObjectIdentifier}")
            print(f"New value: {apdu.listOfValues}")
            
            # Send acknowledgment
            response = SimpleAckPDU(context=apdu)
            self.response(response)
        except Exception as e:
            print(f"Error processing COV notification: {str(e)}")

def main():
    try:
        # Create the application
        app = COVSubscriberApplication()
        
        # Subscribe to COV
        deferred(app.subscribe_to_cov)
        
        # Run the application
        run()
    except KeyboardInterrupt:
        print("\nApplication stopped by user")
    except Exception as e:
        print(f"Application error: {str(e)}")

if __name__ == "__main__":
    main() 