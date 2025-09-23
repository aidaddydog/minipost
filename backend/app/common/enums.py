from enum import Enum
class ShipmentStatus(str, Enum):
    pending="pending"; label_created="label_created"; in_transit="in_transit"; delivered="delivered"; exception="exception"; canceled="canceled"
