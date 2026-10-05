const AvailabilityStatus = require('../models/AvailabilityStatus');
const User = require('../models/User');
const { expandRecurringBlocks } = require('../utils/recurringFocus');
const { logAudit } = require('../utils/auditLog');

// @desc    Get CEO availability
// @route   GET /api/availability
// @access  Private
const getAvailability = async (req, res) => {
  try {
    const ceoUser = await User.findOne({ role: 'ceo' });
    if (!ceoUser) return res.status(404).json({ success: false, message: 'CEO not found' });

    let availability = await AvailabilityStatus.findOne({ ceo: ceoUser._id });
    if (!availability) {
      availability = await AvailabilityStatus.create({ ceo: ceoUser._id });
    }

    res.json({ success: true, availability });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update CEO availability
// @route   PUT /api/availability
// @access  CEO
const updateAvailability = async (req, res) => {
  try {
    const { status, message } = req.body;
    const io = req.app.get('io');

    let availability = await AvailabilityStatus.findOne({ ceo: req.user.id });
    if (!availability) {
      availability = await AvailabilityStatus.create({ ceo: req.user.id });
    }

    const prevStatus = availability.status;
    if (status) availability.status = status;
    if (message !== undefined) availability.message = message;
    availability.updatedAt = new Date();
    await availability.save();

    io.emit('ceo_status_changed', { status: availability.status, message: availability.message });

    if (status && status !== prevStatus) {
      await logAudit(req, {
        action: 'availability.status_change',
        resourceType: 'AvailabilityStatus',
        resourceId: availability._id,
        summary: `CEO status changed to ${status}`,
        metadata: { previous: prevStatus },
      });
    }

    res.json({ success: true, availability });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Add focus block to calendar (supports recurrence)
// @route   POST /api/availability/focus-block
// @access  CEO
const addFocusBlock = async (req, res) => {
  try {
    const { title, startTime, endTime, type, recurrence } = req.body;

    let availability = await AvailabilityStatus.findOne({ ceo: req.user.id });
    if (!availability) {
      availability = await AvailabilityStatus.create({ ceo: req.user.id });
    }

    const template = {
      title,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      type,
      recurrence: recurrence || { enabled: false },
    };

    const instances = expandRecurringBlocks(template, 8);
    availability.focusBlocks.push(...instances);
    await availability.save();

    const io = req.app.get('io');
    if (io) io.emit('focus_blocks_updated');

    await logAudit(req, {
      action: 'focus_block.add',
      resourceType: 'AvailabilityStatus',
      resourceId: availability._id,
      summary: `Added focus block "${title}"${recurrence?.enabled ? ' (recurring)' : ''}`,
      metadata: { instanceCount: instances.length },
    });

    res.json({ success: true, availability, added: instances.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Remove focus block
// @route   DELETE /api/availability/focus-block/:blockId
// @access  CEO
const removeFocusBlock = async (req, res) => {
  try {
    const { scope = 'this' } = req.query;
    const availability = await AvailabilityStatus.findOne({ ceo: req.user.id });
    if (!availability) return res.status(404).json({ success: false, message: 'Not found' });

    const block = availability.focusBlocks.id(req.params.blockId);
    if (!block) return res.status(404).json({ success: false, message: 'Block not found' });

    const seriesId = block.parentSeriesId;
    if (scope === 'series' && seriesId) {
      availability.focusBlocks = availability.focusBlocks.filter(
        (b) => String(b.parentSeriesId) !== String(seriesId)
      );
    } else {
      availability.focusBlocks.pull(req.params.blockId);
    }

    await availability.save();

    const io = req.app.get('io');
    if (io) io.emit('focus_blocks_updated');

    await logAudit(req, {
      action: 'focus_block.remove',
      resourceType: 'AvailabilityStatus',
      resourceId: availability._id,
      summary: `Removed focus block "${block.title}" (${scope})`,
    });

    res.json({ success: true, message: 'Focus block removed', availability });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAvailability, updateAvailability, addFocusBlock, removeFocusBlock };
