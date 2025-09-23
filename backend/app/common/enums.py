from enum import Enum

class ShipmentStatus(str, Enum):
    pending = "pending"
    label_created = "label_created"
    in_transit = "in_transit"
    arrived = "arrived"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    exception = "exception"
    canceled = "canceled"

class TransportMode(str, Enum):
    # 与 docs/minipost_Field V1.1.yaml -> enums.transport_mode 一致
    express = "express"
    postal = "postal"
    air = "air"
    sea = "sea"
    rail = "rail"
    truck = "truck"
    multimodal = "multimodal"
    pickup = "pickup"
    local_courier = "local_courier"
