#include "OfflineBuffer.h"

OfflineBuffer::OfflineBuffer(int capacity)
  : _capacity(capacity), _head(0), _tail(0), _count(0) {
  _buffer = new BufferedTelemetryItem[_capacity];
}

OfflineBuffer::~OfflineBuffer() {
  delete[] _buffer;
}

bool OfflineBuffer::push(const GpsTelemetryData& data, unsigned long timestamp) {
  if (isFull()) {
    // Overwrite oldest item to avoid running out of RAM (FIFO ring overwrite)
    _head = (_head + 1) % _capacity;
    _count--;
  }

  _buffer[_tail].epochTimestamp = timestamp;
  _buffer[_tail].telemetry = data;
  _tail = (_tail + 1) % _capacity;
  _count++;
  return true;
}

bool OfflineBuffer::pop(BufferedTelemetryItem& itemOut) {
  if (isEmpty()) return false;

  itemOut = _buffer[_head];
  _head = (_head + 1) % _capacity;
  _count--;
  return true;
}

int OfflineBuffer::count() const {
  return _count;
}

bool OfflineBuffer::isEmpty() const {
  return _count == 0;
}

bool OfflineBuffer::isFull() const {
  return _count == _capacity;
}

void OfflineBuffer::clear() {
  _head = 0;
  _tail = 0;
  _count = 0;
}
