#ifndef OFFLINE_BUFFER_H
#define OFFLINE_BUFFER_H

#include <Arduino.h>
#include "HAL/IGpsDriver.h"

struct BufferedTelemetryItem {
  unsigned long epochTimestamp;
  GpsTelemetryData telemetry;
};

class OfflineBuffer {
private:
  int _capacity;
  BufferedTelemetryItem* _buffer;
  int _head;
  int _tail;
  int _count;

public:
  OfflineBuffer(int capacity = 50);
  ~OfflineBuffer();

  bool push(const GpsTelemetryData& data, unsigned long timestamp);
  bool pop(BufferedTelemetryItem& itemOut);
  int count() const;
  bool isEmpty() const;
  bool isFull() const;
  void clear();
};

#endif // OFFLINE_BUFFER_H
