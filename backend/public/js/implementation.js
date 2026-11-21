/**
 * Pramaan Implementation Stepper & Interactive Code Snippet
 */
(function () {
  function initImplementation() {
    const stepBlocks = document.querySelectorAll(".sdk-step-block");
    const totalSteps = stepBlocks.length;
    if (totalSteps === 0) return;

    let currentStep = 1;

    const currentStepNumEl = document.getElementById("currentStepNum");
    const totalStepNumEl = document.getElementById("totalStepNum");
    const prevBtn = document.getElementById("prevStepBtn");
    const nextBtn = document.getElementById("nextStepBtn");
    const nextLabel = document.getElementById("nextStepLabel");
    const stepNavBtns = document.querySelectorAll(".step-nav-btn");
    const indicatorDots = document.querySelectorAll(".step-indicator-dot");

    const copyCodeBtn = document.getElementById("copyCodeBtn");
    const copyCodeIcon = document.getElementById("copyCodeIcon");
    const copiedCodeIcon = document.getElementById("copiedCodeIcon");
    const copyCodeLabel = document.getElementById("copyCodeLabel");

    const copyInstallBtn = document.getElementById("copyInstallBtn");
    const copyInstallIcon = document.getElementById("copyInstallIcon");
    const copiedInstallIcon = document.getElementById("copiedInstallIcon");
    const installCmdText = document.getElementById("installCmdText");

    if (totalStepNumEl) {
      totalStepNumEl.textContent = String(totalSteps);
    }

    const copyToClipboard = async (text) => {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch (_e) {
          // Fall through to fallback
        }
      }
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "0";
        textarea.style.left = "0";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        return success;
      } catch (err) {
        console.error("Copy failed:", err);
        return false;
      }
    };

    const updateView = (step) => {
      currentStep = step;

      // 1. Toggle step code visibility explicitly via class and style
      stepBlocks.forEach((block, idx) => {
        if (idx + 1 === step) {
          block.classList.remove("hidden");
          block.style.display = "block";
          block.style.opacity = "1";
        } else {
          block.classList.add("hidden");
          block.style.display = "none";
          block.style.opacity = "0";
        }
      });

      // 2. Update step numbers
      if (currentStepNumEl) {
        currentStepNumEl.textContent = String(step);
      }

      // 3. Update indicator dots
      indicatorDots.forEach((dot, idx) => {
        if (idx + 1 === step) {
          dot.className = "step-indicator-dot w-2 h-2 rounded-full bg-brand-orange transition-all duration-200";
        } else {
          dot.className = "step-indicator-dot w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 transition-all duration-200";
        }
      });

      // 4. Update stepper navigation pills
      stepNavBtns.forEach((btn) => {
        const target = Number(btn.getAttribute("data-step-target"));
        if (target === step) {
          btn.className = "step-nav-btn px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 bg-brand-orange text-white shadow-md shadow-brand-orange/20 cursor-pointer flex items-center gap-1.5";
        } else {
          btn.className = "step-nav-btn px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 bg-slate-100 dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer flex items-center gap-1.5";
        }
      });

      // 5. Update Previous button state & styles
      if (prevBtn) {
        prevBtn.disabled = step === 1;
        if (step === 1) {
          prevBtn.classList.add("opacity-40", "cursor-not-allowed");
          prevBtn.classList.remove("cursor-pointer", "text-slate-700", "dark:text-slate-200");
        } else {
          prevBtn.classList.remove("opacity-40", "cursor-not-allowed");
          prevBtn.classList.add("cursor-pointer", "text-slate-700", "dark:text-slate-200");
        }
      }

      // 6. Update Next button label & state
      if (nextLabel) {
        if (step === totalSteps) {
          nextLabel.textContent = "Restart";
        } else {
          nextLabel.textContent = "Next Step";
        }
      }
    };

    // Nav Button Listeners
    if (prevBtn) {
      prevBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentStep > 1) {
          updateView(currentStep - 1);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentStep < totalSteps) {
          updateView(currentStep + 1);
        } else {
          updateView(1);
        }
      });
    }

    stepNavBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = Number(btn.getAttribute("data-step-target"));
        if (target >= 1 && target <= totalSteps) {
          updateView(target);
        }
      });
    });

    // Copy Code Handler
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const activeBlock = document.getElementById(`stepCode-${currentStep}`);
        if (!activeBlock) return;

        const codeEl = activeBlock.querySelector("code");
        const textToCopy = codeEl ? codeEl.innerText : activeBlock.innerText;

        const success = await copyToClipboard(textToCopy);
        if (success && copyCodeIcon && copiedCodeIcon && copyCodeLabel) {
          copyCodeIcon.classList.add("hidden");
          copiedCodeIcon.classList.remove("hidden");
          copyCodeLabel.textContent = "Copied ✓";

          setTimeout(() => {
            copyCodeIcon.classList.remove("hidden");
            copiedCodeIcon.classList.add("hidden");
            copyCodeLabel.textContent = "Copy";
          }, 1800);
        }
      });
    }

    // Copy Install Cmd Handler
    if (copyInstallBtn && installCmdText) {
      copyInstallBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const text = installCmdText.textContent?.trim() || "npm i @anuj304/pramaan";
        const success = await copyToClipboard(text);
        if (success && copyInstallIcon && copiedInstallIcon) {
          copyInstallIcon.classList.add("hidden");
          copiedInstallIcon.classList.remove("hidden");

          setTimeout(() => {
            copyInstallIcon.classList.remove("hidden");
            copiedInstallIcon.classList.add("hidden");
          }, 1800);
        }
      });
    }

    // Initialize Step 1
    updateView(1);
  }

  // Execute immediately if DOM is already ready, or on DOMContentLoaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initImplementation);
  } else {
    initImplementation();
  }
})();
