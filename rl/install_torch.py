"""Installs PyTorch with the CUDA build that works on this PC (tries the newest first), or the CPU build if there is no usable GPU."""
import shutil
import subprocess
import sys

BUILDS = ["cu130", "cu128", "cu126", "cu124"]  # newest first; the download site only offers builds for Python versions it supports


def pip(*args):
    return subprocess.call([sys.executable, "-m", "pip", *args])


def cuda_ok():
    return subprocess.run([sys.executable, "-c", "import torch, sys; sys.exit(0 if torch.cuda.is_available() else 3)"], capture_output=True).returncode == 0


def main():
    print("Python", sys.version.split()[0])
    if cuda_ok():
        print("PyTorch with a working GPU is already installed.")
        return 0
    if shutil.which("nvidia-smi"):
        for b in BUILDS:
            print("Trying the PyTorch %s build..." % b)
            if pip("install", "--upgrade", "torch", "--index-url", "https://download.pytorch.org/whl/" + b) != 0:
                continue
            if cuda_ok():
                print("PyTorch %s installed and the GPU works." % b)
                return 0
            print("The %s build installed but cannot use the GPU; trying the next one." % b)
            pip("uninstall", "-y", "torch")
        print("No CUDA build worked (the driver may be old: update the NVIDIA driver, or this Python version may be too new: install Python 3.12). Installing the CPU build instead.")
    else:
        print("No NVIDIA GPU found (nvidia-smi is missing): installing the CPU build.")
    if pip("install", "--upgrade", "torch", "--index-url", "https://download.pytorch.org/whl/cpu") != 0 and pip("install", "--upgrade", "torch") != 0:
        print("Could not install PyTorch. If the messages above say 'no matching distribution', install Python 3.12 from python.org, delete the .venv folder and run setup_windows.bat again.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
