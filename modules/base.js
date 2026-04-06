/**
 * Abstract base class to build off of.
 * 
 * This represents a specific set of moderation actions to perform across Wikidot sites.
 */
class BaseModule {
  static id = "base";
  schedule = {};

  constructor(config) {
    this.config = config;
  }

  /**
   * This schedules the module for periodic execution of moderation task.
   */
  start() {};

  /**
   * This stops the module for periodic execution of moderation task.
   */
  stop() {};
}

module.exports = BaseModule;
